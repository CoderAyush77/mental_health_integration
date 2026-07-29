import os
import glob

frontend_dir = r"c:\Users\APLUS\Desktop\Backend\frontend"

html_files = glob.glob(os.path.join(frontend_dir, "**", "*.html"), recursive=True)

toast_tags = """
    <!-- Custom Global Toast -->
    <link rel="stylesheet" href="/toast.css">
    <script src="/toast.js"></script>
"""

for filepath in html_files:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    if "toast.js" in content:
        continue # Already injected
        
    # Inject right before </head>
    if "</head>" in content:
        new_content = content.replace("</head>", f"{toast_tags}</head>")
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Injected toast into {filepath}")
    else:
        print(f"Could not find </head> in {filepath}")

print("Done injecting custom toast!")
