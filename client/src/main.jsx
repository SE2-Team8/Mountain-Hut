import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router/dom";
import router from "@/router";
import '@/assets/css/style.css';
import { Toaster } from "@/components/ui/sonner";

window.document.documentElement.classList.add(
  window.matchMedia("(prefers-color-scheme: dark)").matches ?
    "dark" :
    "light"
);

ReactDOM
  .createRoot(document.getElementById("root"))
  .render(
    <React.StrictMode>

      <Toaster />
      <RouterProvider router={router} />

    </React.StrictMode>
  );
