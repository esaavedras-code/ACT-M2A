const fs = require('fs');
const { createCanvas } = require('@napi-rs/canvas');

async function generateIcon() {
    const size = 512;
    const canvas = createCanvas(size, size);
    const ctx = canvas.getContext('2d');

    // Background Gradient (Elegant Navy)
    const grad = ctx.createLinearGradient(0, 0, size, size);
    grad.addColorStop(0, '#0f172a'); // slate-900
    grad.addColorStop(1, '#1e293b'); // slate-800
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(0, 0, size, size, 120);
    ctx.fill();

    // Subtle Inner Glow
    ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.lineWidth = 10;
    ctx.stroke();

    // Iconic Element: Stylized Bridge/Road + P
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(0,0,0,0.5)';

    // Gold Accent
    const goldGrad = ctx.createLinearGradient(size * 0.3, size * 0.3, size * 0.7, size * 0.7);
    goldGrad.addColorStop(0, '#fde047'); // yellow-300
    goldGrad.addColorStop(0.5, '#eab308'); // yellow-500
    goldGrad.addColorStop(1, '#854d0e'); // yellow-900

    ctx.fillStyle = goldGrad;

    // Drawing a stylized "A" (for ACT) or bridge structure
    // Let's go with a bridge shape that forms a "P" or "A"
    ctx.beginPath();
    ctx.moveTo(size * 0.2, size * 0.8);
    ctx.lineTo(size * 0.5, size * 0.2);
    ctx.lineTo(size * 0.8, size * 0.8);
    ctx.lineWidth = 40;
    ctx.strokeStyle = '#3b82f6'; // blue-500
    ctx.stroke();

    // The road crossbar (Gold)
    ctx.beginPath();
    ctx.moveTo(size * 0.3, size * 0.6);
    ctx.lineTo(size * 0.7, size * 0.6);
    ctx.lineWidth = 30;
    ctx.strokeStyle = goldGrad;
    ctx.stroke();

    // Text "PACT" in luxury font style
    ctx.fillStyle = 'white';
    ctx.font = 'black 100px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('PACT', size / 2, size * 0.9);

    const buffer = await canvas.encode('png');
    fs.writeFileSync('public/icon.png', buffer);
    console.log('Icono generado exitosamente en public/icon.png');
}

generateIcon().catch(console.error);
