git add .
git commit -m "Aplicar regla retroactiva sobre calculo de fechas a 24h"
git push
vercel --prod > deploy_output_v5.txt 2>&1
npm run electron:build > build_exe_0629.txt 2>&1
