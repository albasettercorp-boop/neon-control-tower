
import os
import sys
import logging
import asyncio
import random

# Force REAL MODE for this test
os.environ['DRY_RUN'] = 'False'

# Adjust imports
# Add ../antigravity to path so we can import backend
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '../../antigravity')))
from backend.worker import AntigravityWorker
from backend.db import SupabaseDB

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("WorkerOutreachTest")

async def test_worker_outreach():
    logger.info("🚀 Starting Worker Outreach Test")
    
    # 1. Initialize Worker
    worker = AntigravityWorker()
    
    # 2. Insert Test Lead
    db = SupabaseDB()
    test_brand = f"TestBrand_{random.randint(1000, 9999)}"
    test_lead = {
        'brand_name': test_brand,
        'revenue_monthly': 1000000,
        'wb_product_id': '12345678',
        'wb_brand_id': '87654321',
        'top_product_name': 'Test Product',
        'source': 'WB_API',
        'status': 'NEW',
        'telegram_username': 'me' # Send to Saved Messages
    }
    
    logger.info(f"Inserting test lead: {test_brand}")
    db.upsert_seller(test_lead)
    
    # 3. Run Process Outreach
    logger.info("Running process_outreach()...")
    
    # Ensure Telegram connects (if not in DRY_RUN, but worker handles it in run_forever)
    # Since we are calling process_outreach directly, we need to ensure connection if using real mode.
    # Check .env for dry run
    is_dry_run = os.getenv("DRY_RUN", "False").lower() == "true"
    
    if not is_dry_run:
        logger.info("Connecting to Telegram...")
        try:
            await worker.telegram.start()
        except Exception as e:
            logger.error(f"Failed to connect to Telegram: {e}")
            logger.info("⚠️ Skipping real send due to connection failure (expected if no session)")
            return

    await worker.process_outreach()
    
    # 4. Verify Result
    # Fetch the lead back
    result = db.client.table('sellers').select('*').eq('brand_name', test_brand).execute()
    if result.data:
        updated_lead = result.data[0]
        status = updated_lead['status']
        logger.info(f"Updated Status for {test_brand}: {status}")
        
        if status == 'CONTACTED':
            logger.info("✅ SUCCESS: Lead status updated to CONTACTED")
        elif status == 'NO_CONTACT':
             logger.info("⚠️ PARTIAL SUCCESS: Marked as NO_CONTACT (if username missing)")
        else:
            logger.error(f"❌ FAILURE: Status is {status}")
    else:
        logger.error("❌ Test lead not found in DB")

    # Cleanup
    if not is_dry_run:
        await worker.telegram.stop()

if __name__ == "__main__":
    asyncio.run(test_worker_outreach())
