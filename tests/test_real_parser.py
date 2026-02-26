
import asyncio
import os
import sys
import logging

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RealParserTest")

# Add backend to path
current_dir = os.path.dirname(os.path.abspath(__file__))
antigravity_path = os.path.abspath(os.path.join(current_dir, '../../antigravity'))
if str(antigravity_path) not in sys.path:
    sys.path.append(antigravity_path)

try:
    from backend.wb_parser import AsyncWbParser
except ImportError as e:
    logger.error(f"Failed to import backend: {e}")
    sys.exit(1)

async def test_parser():
    logger.info("🚀 Starting Real Parser Test")
    
    parser = AsyncWbParser()
    
    # Test params
    query = "платье женское"
    max_results = 3
    
    logger.info(f"Searching for '{query}' with accurate revenue...")
    
    try:
        products = await parser.search_and_filter(
            query=query,
            min_revenue=0,
            max_results=max_results,
            use_accurate_revenue=True
        )
        
        logger.info(f"Found {len(products)} products")
        
        for p in products:
            print(f"\nProduct: {p.name[:50]}...")
            print(f"  ID: {p.id}")
            print(f"  Price: {p.price}")
            print(f"  Revenue: {p.estimated_revenue:,.0f} ₽")
            print(f"  Orders: {p.orders_count}")
            # We can't easily check 'source' here as it's not on the model, but usually log shows it
            
            if p.estimated_revenue > 0:
                print("  ✅ Revenue extracted/estimated")
            else:
                print("  ⚠️ No revenue")
                
    except Exception as e:
        logger.error(f"Test failed: {e}")
    finally:
        if parser.client:
             parser.client.close()

if __name__ == "__main__":
    asyncio.run(test_parser())
