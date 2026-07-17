import requests
import re
from html.parser import HTMLParser

class TextExtractor(HTMLParser):
    """Strips HTML tags, returns clean text."""
    def __init__(self):
        super().__init__()
        self._text = []
        self._skip = False
    
    def handle_starttag(self, tag, attrs):
        if tag in ('script', 'style', 'noscript'):
            self._skip = True
        if tag in ('p', 'br', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'tr'):
            self._text.append('\n')
    
    def handle_endtag(self, tag):
        if tag in ('script', 'style', 'noscript'):
            self._skip = False
        if tag in ('p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'td', 'th'):
            self._text.append('\n')
    
    def handle_data(self, data):
        if not self._skip:
            self._text.append(data)
    
    def text(self):
        return re.sub(r'\n{3,}', '\n\n', ''.join(self._text)).strip()

def get_fandom_page(wiki_name, page_title):
    # Correct Fandom wiki API URL
    url = f"https://{wiki_name}.fandom.com/api.php"
    
    params = {
        "action": "parse",
        "page": page_title,
        "format": "json",
        "prop": "text",
        "redirects": "true"
    }
    
    headers = {
        "User-Agent": "LoredeckBuilder/1.0 (research use)"
    }
    
    try:
        response = requests.get(url, params=params, headers=headers, timeout=15)
        response.raise_for_status()
        data = response.json()
        
        if "error" in data:
            return f"API Error: {data['error']['info']}"
        if "parse" not in data:
            return f"Unexpected response: no 'parse' key"
            
        html_content = data["parse"]["text"]["*"]
        
        # Clean to plain text
        extractor = TextExtractor()
        extractor.feed(html_content)
        return extractor.text()
        
    except requests.exceptions.RequestException as e:
        return f"HTTP Request failed: {e}"

if __name__ == "__main__":
    import sys
    args = sys.argv[1:]
    if len(args) < 2:
        print("Usage: python fetch_fandom.py <wiki> <page_title>")
        print("Example: python fetch_fandom.py dragonlance List_of_Dragonlance_deities")
        sys.exit(1)
    
    wiki = args[0]
    title = " ".join(args[1:])
    result = get_fandom_page(wiki, title)
    print(result[:3000] if len(result) > 3000 else result)
