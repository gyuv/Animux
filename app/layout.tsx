// app/layout.tsx
import './globals.css'; // <-- This line is essential for Tailwind to load!

export const metadata = {
  title: 'Animux | Next-Gen Anime Streaming',
  description: 'Advanced anime streaming web app.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-[#0a0a0c] text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
