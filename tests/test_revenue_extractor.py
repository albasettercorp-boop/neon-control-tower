
import asyncio
import os
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RevenueExtractorTest")

# Add backend to path
current_dir = os.path.dirname(os.path.abspath(__file__))
antigravity_path = os.path.abspath(os.path.join(current_dir, '../../antigravity'))
if str(antigravity_path) not in sys.path:
    sys.path.append(antigravity_path)

try:
    from backend.revenue_extractor import RevenueExtractor
except ImportError as e:
    logger.error(f"Failed to import backend: {e}")
    sys.exit(1)

async def test_extractor():
    logger.info("🚀 Starting Revenue Extractor Test")
    
    extractor = RevenueExtractor()
    await extractor.init_browser()
    
    # Valid product ID from previous logs
    # product_id = "766884177" # Skims dress
    # Or "123456"
    product_id = "242519205" 
    
    logger.info(f"Extracting revenue for {product_id}...")
    
    try:
        data = await extractor.get_accurate_revenue(product_id)
        if data:
            logger.info(f"✅ Success: {data}")
        else:
            logger.warning("❌ Failed to extract revenue")
            
    except Exception as e:
        logger.error(f"Test failed: {e}")
    finally:
        await extractor.close()

if __name__ == "__main__":
    asyncio.run(test_extractor())
