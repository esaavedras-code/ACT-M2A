const fs = require('fs');
const path = require('path');
const dir = 'src/components';
const files = fs.readdirSync(dir).filter(f => f.endsWith('.tsx'));

const snippet = `            {numAct && (
                <div className="flex items-center gap-2 -mt-4 mb-6">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Proyecto:</span>
                    <span className="px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 text-primary text-[10px] font-bold rounded border border-blue-100 dark:border-blue-800">
                        ACT-{numAct}
                    </span>
                </div>
            )}`;

let count = 0;
for (const file of files) {
  const filePath = path.join(dir, file);
  let content = fs.readFileSync(filePath, 'utf8');
  if (content.includes(snippet)) {
    content = content.replace(snippet, '');
    fs.writeFileSync(filePath, content);
    console.log('Removed from', file);
    count++;
  }
}
console.log('Total files modified:', count);
