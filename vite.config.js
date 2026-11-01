import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Build trên Cloudflare Workers (WORKERS_CI) → có worker/index.js: bắt buộc đăng nhập, bài học + slide lấy qua /data/.
// Muốn bật/tắt thủ công: đặt biến LOGIN=1 hoặc LOGIN=0 khi build.
const onWorkers = Boolean(process.env.WORKERS_CI)
const login = process.env.LOGIN ? process.env.LOGIN === '1' : onWorkers

export default defineConfig({
  plugins: [react()],
  // GitHub Pages phục vụ web ở /GiangGiangLearn/; Cloudflare Pages (CF_PAGES) và Workers (WORKERS_CI) phục vụ ở gốc tên miền.
  base: process.env.CF_PAGES || onWorkers ? '/' : '/GiangGiangLearn/',
  // public/ chỉ chứa content/ và media/. Khi bật đăng nhập chúng chỉ được lấy qua Worker (/data/ → R2),
  // nên không chép vào dist/ – nếu chép thì ai cũng mở được /content/… và /media/… mà không cần đăng nhập.
  publicDir: login ? false : 'public',
  define: { __LOGIN__: JSON.stringify(login) },
})
