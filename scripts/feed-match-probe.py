"""
Can mentions of a listed tool be found, and matched, on free sources?

  python3 -I scripts/feed-match-probe.py [out.json]

Step one of the social discussion idea (seed-social-discussion in
lib/ideas.js). For ten tools, five with distinctive names and five with
ordinary words, it searches each free source once by domain and once by name
and keeps the top 10 results with their text. Nothing here is built into the
site: it is the test that decides whether a feed is possible at all.

Sources, as found on 2026-10-23:
  Hacker News (Algolia API), Bluesky (api.bsky.app searchPosts; the
  public.api host answers 403), Reddit (search.rss; the .json endpoints answer
  403), Shopify Community and community.shopify.dev (Discourse search.json),
  GitHub issues (unauthenticated search, 10 a minute), Product Hunt (through
  Firecrawl's cloud scrape; the site answers 403 directly).
  Not usable: Indie Hackers retired its search in 2026. Lobste.rs is behind an
  Anubis proof-of-work wall; through Firecrawl it works, and returns only
  programming posts for these names.

Precision is judged by hand: scripts/feed-match-labels.json lists the results
that were genuinely about the tool, and the name collisions seen. The result,
read 2026-10-23: a domain in the text was about the tool 16 times in 16. A name
in the text was about the tool 10 times in 185, and 0 in 162 for Meridian,
Orbit, Elevate, SAMI and Prys. So a feed can only be domain mentions.
"""
import json, subprocess, time, urllib.parse as up, re, sys, html, os
OUT = sys.argv[1] if len(sys.argv) > 1 else "feed-match-results.json"
UA = "Mozilla/5.0 (compatible; watchfor.tools-matchtest/0.1; +https://watchfor.tools)"
TOOLS = [
  ("storeleads","Store Leads","storeleads.app",""),
  ("appstorepulse","AppstorePulse","appstorepulse.com",""),
  ("partnerdock","PartnerDock","getpartnerdock.com",""),
  ("meridian","Meridian","the-meridian.ai",""),
  ("orbit","Orbit","marmeto.com","/orbit"),
  ("elevate","Elevate","marmeto.com","/elevate"),
  ("applora","Applora","applora.ai",""),
  ("tracksami","SAMI","tracksami.com",""),
  ("krutva","Krutva","krutva.com",""),
  ("prys","Prys","prys.io",""),
]
N = 10
def get(url, data=None, tries=3):
    for i in range(tries):
        cmd = ["curl","-s","-L","-m","40","-A",UA,url]
        if data is not None: cmd = ["curl","-s","-m","90","-X","POST","-H","Content-Type: application/json","-d",json.dumps(data),url]
        r = subprocess.run(cmd, capture_output=True, text=True)
        if r.returncode == 0 and r.stdout: return r.stdout
        time.sleep(2)
    return ""
def jget(url, data=None):
    try: return json.loads(get(url, data))
    except Exception: return None
strip = lambda s: html.unescape(re.sub(r"<[^>]+>"," ", s or ""))

def hn(q):
    d = jget(f"https://hn.algolia.com/api/v1/search?query={up.quote(q)}&hitsPerPage={N}") or {}
    return [{"url": h.get("url") or f"https://news.ycombinator.com/item?id={h['objectID']}", "text": " ".join(filter(None,[h.get("title"), strip(h.get("story_text")), strip(h.get("comment_text")), h.get("url") or ""]))} for h in d.get("hits",[])]
def bsky(q):
    d = jget(f"https://api.bsky.app/xrpc/app.bsky.feed.searchPosts?q={up.quote(q)}&limit={N}") or {}
    out=[]
    for p in d.get("posts",[]):
        rec=p.get("record",{}); emb=(p.get("embed") or {}).get("external",{}) or {}
        links=" ".join(f.get("uri","") for fa in rec.get("facets",[]) or [] for f in fa.get("features",[]) if f.get("uri"))
        out.append({"url": f"https://bsky.app/profile/{p['author']['handle']}/post/{p['uri'].split('/')[-1]}", "text": " ".join([rec.get("text",""), emb.get("uri",""), emb.get("title",""), links])})
    return out
def reddit(q):
    x = get(f"https://www.reddit.com/search.rss?q={up.quote(q)}&limit={N}&sort=relevance")
    out=[]
    for e in re.findall(r"<entry>(.*?)</entry>", x, re.S)[:N]:
        link=(re.search(r'<link href="([^"]+)"',e) or [None,""])[1]
        title=strip((re.search(r"<title>(.*?)</title>",e,re.S) or [None,""])[1])
        content=strip(html.unescape((re.search(r"<content[^>]*>(.*?)</content>",e,re.S) or [None,""])[1]))
        out.append({"url":link,"text":f"{title} {content}"})
    return out
def discourse(base):
    def f(q):
        d = jget(f"{base}/search.json?q={up.quote(q)}") or {}
        topics={t["id"]:t for t in d.get("topics",[])}
        return [{"url": f"{base}/t/{p.get('topic_id')}/{p.get('post_number',1)}", "text": f"{topics.get(p.get('topic_id'),{}).get('title','')} {strip(p.get('blurb'))}"} for p in d.get("posts",[])[:N]]
    return f
def github(q):
    d = jget(f"https://api.github.com/search/issues?q={up.quote(q)}&per_page={N}") or {}
    time.sleep(7)
    return [{"url": i["html_url"], "text": f"{i.get('title','')} {(i.get('body') or '')[:3000]}"} for i in d.get("items",[])]
def lobsters(q):
    x = get(f"https://lobste.rs/search?q={up.quote(q)}&what=stories&order=relevance")
    out=[]
    for m in re.finditer(r'<a class="u-url" href="([^"]+)"[^>]*>(.*?)</a>', x, re.S):
        out.append({"url":m.group(1),"text":f"{strip(m.group(2))} {m.group(1)}"})
    return out[:N]
def firecrawl(urlf):
    def f(q):
        d = jget("https://api.firecrawl.dev/v1/scrape", {"url": urlf(q), "formats":["markdown"], "waitFor": 3000}) or {}
        md = (d.get("data") or {}).get("markdown","")
        if not md: return [{"url":"","text":"__FAILED__ " + json.dumps(d)[:200]}]
        # each block: a product/post line with a link
        items=[]
        for line in md.split("\n"):
            line=line.strip()
            if len(line)<20 or line.startswith("!["): continue
            m=re.search(r"\]\((https?://[^)\s]+)\)",line)
            items.append({"url": m.group(1) if m else "", "text": re.sub(r"!\[[^\]]*\]\([^)]*\)","",line)})
        return items[:N*2]
    return f
SOURCES = {
  "hackernews": hn, "bluesky": bsky, "reddit": reddit,
  "shopify-community": discourse("https://community.shopify.com"),
  "shopify-dev-community": discourse("https://community.shopify.dev"),
  "github": github, "lobsters": lobsters,
  "producthunt": firecrawl(lambda q: f"https://www.producthunt.com/search?q={up.quote(q)}"),
  "indiehackers": firecrawl(lambda q: f"https://www.indiehackers.com/search?q={up.quote(q)}"),
}
res = json.load(open(OUT)) if os.path.exists(OUT) else []
done = {(r["tool"],r["source"],r["mode"]) for r in res}
for tid,name,domain,path in TOOLS:
    for mode,q in [("domain", domain + path if path else domain), ("name", name)]:
        for sname,fn in SOURCES.items():
            if (tid,sname,mode) in done: continue
            try: items = fn(q)
            except Exception as e: items=[{"url":"","text":f"__FAILED__ {e}"}]
            for it in items: res.append({"tool":tid,"name":name,"domain":domain,"path":path,"source":sname,"mode":mode,"q":q,**it})
            if not items: res.append({"tool":tid,"name":name,"domain":domain,"path":path,"source":sname,"mode":mode,"q":q,"url":"","text":"__EMPTY__"})
            json.dump(res, open(OUT,"w"))
            print(tid, mode, sname, len(items), flush=True)
