import React from "react";

import type { Metadata } from "next";

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
