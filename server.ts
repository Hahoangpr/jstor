import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Support Endpoint (Static)
  const faqs = [
    {
      id: 1,
      question: "Làm thế nào để tải game sau khi mua?",
      answer: "Sau khi hoàn tất thanh toán, bạn có thể vào 'Thư viện game' của mình và nhấn nút 'Tải về'. File cài đặt sẽ được tự động tải xuống máy tính của bạn."
    },
    {
      id: 2,
      question: "Nexus Games có hỗ trợ hoàn tiền không?",
      answer: "Chúng tôi hỗ trợ hoàn tiền trong vòng 14 ngày nếu thời gian chơi của bạn dưới 2 giờ. Vui lòng liên hệ bộ phận hỗ trợ để yêu cầu hoàn tiền."
    },
    {
      id: 3,
      question: "Tôi quên mật khẩu, làm sao để lấy lại?",
      answer: "Nhấp vào liên kết 'Quên mật khẩu' tại trang đăng nhập, nhập email của bạn và chúng tôi sẽ gửi hướng dẫn khôi phục mật khẩu."
    },
    {
      id: 4,
      question: "Tại sao game của tôi không chạy được?",
      answer: "Hãy kiểm tra cấu hình máy tính của bạn có đáp ứng yêu cầu tối thiểu của game không. Ngoài ra, hãy đảm bảo driver card đồ họa của bạn đã được cập nhật phiên bản mới nhất."
    }
  ];

  app.get("/api/support/faqs", (req, res) => {
    res.json(faqs);
  });

  app.post("/api/support/contact", (req, res) => {
    const { name, email, subject, message } = req.body;
    console.log("Support Ticket Received:", { name, email, subject, message });
    res.json({ message: "Yêu cầu của bạn đã được gửi thành công. Chúng tôi sẽ phản hồi sớm nhất!" });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
