// app/layout.tsx
import './globals.css'; // Make sure this points to your Tailwind CSS styles

export const metadata = {
  title: 'Animux | Next-Gen Anime Streaming',
  description: 'Advanced anime streaming web app with multi-language support and cross-device sync.',
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
