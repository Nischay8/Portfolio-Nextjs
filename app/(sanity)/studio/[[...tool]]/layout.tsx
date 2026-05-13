import type { Metadata } from "next";
import type React from "react";

export const metadata: Metadata = {
  title: "NextGen Portfolio",
  description: "Created By Nishchay Sinha",
};

function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="bg-background text-foreground">{children}</body>
    </html>
  );
}

export default Layout;
