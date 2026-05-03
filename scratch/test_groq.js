const apiKey = "REMOVED_BY_SCAN";
async function test() {
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Authorization": `Bearer ${apiKey}`,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: "Hola, responde solo con la palabra 'OK'." }]
        })
    });
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
}
test();
