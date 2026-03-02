import requests
from bs4 import BeautifulSoup
import logging

logger = logging.getLogger(__name__)

def scrape_finviz_news():
    """
    Scrapes the top headlines from finviz.com/news.ashx.
    Returns a list of headline strings.
    """
    url = "https://finviz.com/news.ashx"
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
        "Accept-Language": "en-US,en;q=0.9",
        "Referer": "https://finviz.com/"
    }
    
    try:
        response = requests.get(url, headers=headers, timeout=10)
        response.raise_for_status()
        
        soup = BeautifulSoup(response.text, "html.parser")
        headlines = []
        
        # Finviz news headlines are generally in elements with class "nn-tab-link"
        news_links = soup.find_all("a", class_="nn-tab-link")
        
        for link in news_links:
            text = link.get_text(strip=True)
            if text and text not in headlines:
                headlines.append(text)
                
        logger.info(f"Successfully scraped {len(headlines)} headlines from Finviz.")
        return headlines
        
    except Exception as e:
        logger.error(f"Failed to scrape Finviz news: {e}")
        return []

if __name__ == "__main__":
    # Test script output
    news = scrape_finviz_news()
    print(f"Scraped {len(news)} headlines.")
    for h in news[:5]:
        print(f"- {h}")
