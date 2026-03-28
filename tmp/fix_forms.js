const fs = require('fs');
const path = require('path');

const dir = 'c:\\\\Users\\\\Enrique Saavedra\\\\Documents\\\\Programa ACT\\\\src\\\\components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('Form.tsx'));

files.forEach(file => {
    let content = fs.readFileSync(path.join(dir, file), 'utf-8');
    
    // 1. Remove max-w-* recursively
    content = content.replace(/max-w-[a-z0-9]+\s+mx-auto\s*/g, 'w-full ');
    
    // 2. Make headers sticky
    content = content.replace(
        /(<div[^>]*className="[^"]*)(flex items-center justify-between[^"]*bg-slate-50\/95 backdrop-blur-sm[^"]*)(")/g,
        (match, group1, group2, group3) => {
            if (group2.includes("sticky top-")) return match;
            return group1 + group2 + ' sticky top-[48px] z-[35] px-4 -mx-4 shadow-sm' + group3;
        }
    );
    
    fs.writeFileSync(path.join(dir, file), content);
});
console.log("Done");
