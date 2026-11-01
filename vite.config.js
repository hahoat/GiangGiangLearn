import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages phục vụ web ở /GiangGiangLearn/; Cloudflare Pages (CF_PAGES) và Workers (WORKERS_CI) phục vụ ở gốc tên miền.
  base: process.env.CF_PAGES || process.env.WORKERS_CI ? '/' : '/GiangGiangLearn/'
})
