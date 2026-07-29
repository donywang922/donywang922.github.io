import re

html_path = r"d:\donywang922.github.io\ecoloopen\index.html"
md_path = r"d:\donywang922.github.io\ecoloopen\pitch_script.md"

with open(html_path, "r", encoding="utf-8") as f:
    html_content = f.read()

with open(md_path, "r", encoding="utf-8") as f:
    md_content = f.read()

# Parse md_content to get a list of (time, script) for each slide
slides = []
blocks = re.split(r'## Slide \d+:.*', md_content)[1:]
for block in blocks:
    time_match = re.search(r'\*\*Time:\*\*\s*(.+)', block)
    script_match = re.search(r'\*\*Script:\*\*\s*\n\s*>\s*(.+)', block)
    if time_match and script_match:
        time = time_match.group(1).strip()
        script = script_match.group(1).strip()
        
        # Clean up escapes like \[ and \#
        script = re.sub(r'\\(.)', r'\1', script)
        
        # Convert long dashes
        time = time.replace("-", "&ndash;").replace("–", "&ndash;")
        
        slides.append((time, script))

print(f"Found {len(slides)} slides in Markdown.")

# Find all aside notes in HTML
aside_pattern = re.compile(r'\t\t\t\t\t<aside class="notes">.*?</aside>', re.DOTALL)
html_asides = aside_pattern.findall(html_content)

print(f"Found {len(html_asides)} asides in HTML.")

if len(slides) == len(html_asides):
    for i in range(len(slides)):
        time, script = slides[i]
        
        new_aside = f'\t\t\t\t\t<aside class="notes">\n\t\t\t\t\t\t<p><strong>{time}</strong></p>\n\t\t\t\t\t\t<p>{script}</p>\n\t\t\t\t\t</aside>'
        html_content = html_content.replace(html_asides[i], new_aside)

    with open(html_path, "w", encoding="utf-8") as f:
        f.write(html_content)
    print("Updated index.html successfully.")
else:
    print("Mismatch in number of slides.")
