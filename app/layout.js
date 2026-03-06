import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Providers from "@/components/Providers";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata = {
  title: "Future-Connection",
  description: "Chat with anyone, anywhere, anytime. Future-Connection is a revolutionary chat application that connects you with people from around the world. Whether you want to make new friends, find a study buddy, or just have a casual conversation, Future-Connection has got you covered. With our advanced matching algorithm, you'll be paired with someone who shares your interests and hobbies. Join the Future-Connection community today and start chatting with people from all walks of life!",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
