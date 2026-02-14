import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
export default defineConfig({
    plugins: [
        react(),
        VitePWA({
            registerType: "autoUpdate",
            includeAssets: ["icon.svg"],
            manifest: {
                name: "RPG Productivity",
                short_name: "RPG Productivity",
                description: "Offline-first RPG productivity web app",
                theme_color: "#07090f",
                background_color: "#07090f",
                display: "standalone",
                start_url: "/",
                icons: [
                    {
                        src: "/icon.svg",
                        sizes: "192x192",
                        type: "image/svg+xml"
                    }
                ]
            }
        })
    ],
    test: {
        environment: "node",
        globals: true
    }
});
