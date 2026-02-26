
import asyncio
import os
import sys
import uuid
import logging
import json
from datetime import datetime

# Safety for bridge checks: avoid real outbound Telegram sends.
os.environ.setdefault('DRY_RUN', 'True')

# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("E2E_Test")

# Add project root to path (assuming this script is in neon-control-tower)
# We need to access backend which is in ../antigravity/backend
# But wait, python script in neon-control-tower cannot easily import from ../antigravity unless we modify sys.path

# Let's try to map the paths dynamically
current_dir = os.path.dirname(os.path.abspath(__file__))
antigravity_path = os.path.abspath(os.path.join(current_dir, '../../antigravity'))

if str(antigravity_path) not in sys.path:
    sys.path.append(antigravity_path)
    logger.info(f"Added {antigravity_path} to sys.path")

try:
    from backend.db import SupabaseDB
    from backend.worker import AntigravityWorker
except ImportError as e:
    logger.error(f"❌ Failed to import backend components: {e}")
    logger.error("Please run this script from neon-control-tower/tests and ensure ../../antigravity/backend exists.")
    sys.exit(1)

async def run_e2e_test():
    logger.info("🚀 Starting E2E Integration Test")
    
    # 1. Initialize DB
    logger.info("1️⃣  Initializing Database Connection...")
    try:
        # Load env vars from antigravity/.env or just assume they are loaded if running with dotenv
        from dotenv import load_dotenv
        load_dotenv(os.path.join(antigravity_path, 'backend', '.env'))
        
        db = SupabaseDB()
        if not db.client:
            raise Exception("Supabase client not initialized")
        logger.info("✅ Database connected")
    except Exception as e:
        logger.error(f"❌ DB Connection Failed: {e}")
        return

    # 2. Verify Schema (Migration Check)
    logger.info("2️⃣  Verifying Schema (Migration Check)...")
    try:
        # Check parser_jobs columns
        res = db.client.table('parser_jobs').select('min_revenue, category, max_results').limit(1).execute()
        logger.info("✅ 'parser_jobs' columns verified")
        
        # Check account_health table
        res = db.client.table('account_health').select('id, service_name, metadata').limit(1).execute()
        logger.info("✅ 'account_health' table verified")
    except Exception as e:
        logger.error(f"❌ Schema Verification Failed: {e}")
        return

    # 3. Create a Real Parsing Job
    test_query = f"e2e_test_{uuid.uuid4().hex[:6]}"
    logger.info(f"3️⃣  Creating Test Job: query='{test_query}'")
    
    try:
        job_data = {
            'query': test_query,
            'status': 'pending',
            'min_revenue': 100000,
            'max_results': 5,
            'category': 'test_category'
        }
        res = db.client.table('parser_jobs').insert(job_data).execute()
        job_id = res.data[0]['id']
        logger.info(f"✅ Job created: ID={job_id}")
    except Exception as e:
        logger.error(f"❌ Failed to create job: {e}")
        return

    # 4. Deterministic one-shot worker processing for this specific job
    logger.info("4️⃣  Running one-shot worker on created job...")
    try:
        worker = AntigravityWorker()
        processed = await worker.process_parser_job_by_id(job_id)
        if not processed:
            raise RuntimeError(f"Worker could not pick pending job {job_id}")
    except Exception as e:
        logger.error(f"❌ Worker one-shot processing failed: {e}")
        return

    logger.info("   Polling created job status for 30s...")
    for i in range(10):
        res = db.client.table('parser_jobs').select('status, result_count').eq('id', job_id).execute()
        status = res.data[0]['status']
        logger.info(f"   Status: {status}")
        
        if status == 'completed':
            logger.info(f"✅ Job completed! Result count: {res.data[0]['result_count']}")
            break
        elif status == 'failed':
            logger.error("❌ Job failed!")
            break
            
        await asyncio.sleep(3)
    else:
        logger.error("❌ Created job did not reach terminal state in timeout window")
        return

    # 5. Check Health Table
    logger.info("5️⃣  Checking Health Monitor...")
    try:
        res = db.client.table('account_health').select('*').limit(5).execute()
        services = [r['service_name'] for r in res.data]
        logger.info(f"✅ Found health records for: {services}")
    except Exception as e:
        logger.error(f"❌ Health check failed: {e}")

    # 6. Verify ProcessControlPanel bridge: worker_commands -> worker
    logger.info("6️⃣  Verifying worker_commands bridge (health_check)...")
    try:
        cmd = db.client.table('worker_commands').insert({
            'action': 'health_check',
            'params': {},
            'status': 'pending',
        }).execute()
        cmd_id = cmd.data[0]['id']

        await worker.process_worker_commands()

        cmd_state = db.client.table('worker_commands').select('status,error').eq('id', cmd_id).limit(1).execute()
        cmd_row = cmd_state.data[0] if cmd_state.data else None
        if not cmd_row or cmd_row.get('status') != 'completed':
            raise RuntimeError(f"worker_commands bridge failed: {cmd_row}")
        logger.info("✅ worker_commands bridge verified")
    except Exception as e:
        logger.error(f"❌ worker_commands bridge failed: {e}")
        return

    # 7. Verify Chat TG bridge: interactions(PENDING_SEND) -> worker
    logger.info("7️⃣  Verifying ChatInterface bridge (PENDING_SEND -> SENT)...")
    try:
        seller = db.upsert_seller({
            'brand_name': f"phase3_chat_{uuid.uuid4().hex[:8]}",
            'revenue_monthly': 5000000,
            'source': 'TG_CHAT',
            'status': 'QUALIFIED',
            'telegram_username': 'me'
        })
        if not seller:
            raise RuntimeError('Failed to prepare chat bridge seller')

        queue_payload = {
            'seller_id': seller['id'],
            'channel': 'TELEGRAM',
            'direction': 'OUTBOUND',
            'content': 'phase3 pending send test',
            'status': 'PENDING_SEND',
        }
        interaction = db.client.table('interactions').insert(queue_payload).execute()
        if interaction.error:
            queue_payload['status'] = 'FAILED'
            queue_payload['content'] = f"[[PENDING_SEND]] {queue_payload['content']}"
            interaction = db.client.table('interactions').insert(queue_payload).execute()
            if interaction.error:
                raise RuntimeError(f"Failed to enqueue pending send: {interaction.error}")
        interaction_id = interaction.data[0]['id']

        await worker.process_pending_messages()

        interaction_state = db.client.table('interactions').select('status').eq('id', interaction_id).limit(1).execute()
        interaction_row = interaction_state.data[0] if interaction_state.data else None
        if not interaction_row or interaction_row.get('status') != 'SENT':
            raise RuntimeError(f"pending send bridge failed: {interaction_row}")
        logger.info("✅ ChatInterface bridge verified")
    except Exception as e:
        logger.error(f"❌ ChatInterface bridge failed: {e}")
        return

    # 8. Verify SmartFunnel bridge: command -> worker -> SmartFunnel.process_batch
    logger.info("8️⃣  Verifying SmartFunnel bridge (worker command mode)...")
    try:
        for _ in range(3):
            db.upsert_seller({
                'brand_name': f"phase3_funnel_{uuid.uuid4().hex[:8]}",
                'revenue_monthly': 4000000,
                'source': 'WB_API',
                'status': 'NEW'
            })

        sf_cmd = db.client.table('worker_commands').insert({
            'action': 'outreach',
            'params': {
                'mode': 'smart_funnel_batch',
                'source': 'WB_API',
                'limit': 2,
            },
            'status': 'pending',
        }).execute()
        sf_cmd_id = sf_cmd.data[0]['id']

        await worker.process_worker_commands()

        sf_state = db.client.table('worker_commands').select('status,result,error').eq('id', sf_cmd_id).limit(1).execute()
        sf_row = sf_state.data[0] if sf_state.data else None
        if not sf_row or sf_row.get('status') != 'completed':
            raise RuntimeError(f"smart funnel command failed: {sf_row}")

        result_payload = sf_row.get('result') or {}
        if isinstance(result_payload, str):
            result_payload = json.loads(result_payload)
        processed = int(result_payload.get('processed', 0))
        if processed <= 0:
            raise RuntimeError(f"smart funnel processed zero leads: {result_payload}")

        logger.info(f"✅ SmartFunnel bridge verified (processed={processed})")
    except Exception as e:
        logger.error(f"❌ SmartFunnel bridge failed: {e}")
        return

    logger.info("🎉 E2E Test Sequence Finished")

if __name__ == "__main__":
    asyncio.run(run_e2e_test())
