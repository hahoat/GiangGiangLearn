import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // GitHub Pages phục vụ web ở /GiangGiangLearn/; Cloudflare Pages (biến CF_PAGES) phục vụ ở gốc tên miền.
  base: process.env.CF_PAGES ? '/' : '/GiangGiangLearn/'
})
