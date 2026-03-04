import type { Config } from "tailwindcss";

const config: Config = {
    content: [
        "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    theme: {
        extend: {
            colors: {
                background: "var(--background)",
                foreground: "var(--foreground)",
                primary: {
                    DEFAULT: "#0056b3",
                    dark: "#004494",
                },
                secondary: {
                    DEFAULT: "#6c757d",
                    dark: "#5a6268",
                },
            },
        },
    },
    plugins: [],
};
export default config;
