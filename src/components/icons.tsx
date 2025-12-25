
import type { SVGProps } from "react";
import logo from "../assets/logo.png";

export function VisaLogo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="48"
      height="30"
      viewBox="0 0 48 30"
      fill="none"
      {...props}
    >
      <path
        d="M24.707 29.539c-2.146 0-4.041-.85-5.32-2.19l4.47-21.65h6.329l-4.47 21.65c.66.42 1.488.63 2.502.63 2.99 0 4.885-1.574 4.885-4.22 0-2.073-1.238-3.155-3.51-4.25-1.95-.913-2.48-1.554-2.48-2.39 0-.693.8-1.31 2.228-1.31 1.092 0 1.95.313 2.523.65l.47-3.11c-.74-.313-2.12-.625-3.69-.625-2.58 0-4.41 1.015-4.41 3.28 0 2.116 1.55 3.03 3.82 4.085 2.25.998 2.62 1.76 2.62 2.5 0 .956-.99 1.55-2.56 1.55-1.38 0-2.4-.4-3.05-.76l-.51 3.24zm-13.33-23.8h-7.07l-.1 2.37-4.21 21.48h6.41l3.96-20.1z"
        fill="#fff"
      ></path>
    </svg>
  );
}

export function MastercardLogo(props: SVGProps<SVGSVGElement>) {
    // Placeholder for Mastercard logo
    return (
        <svg width="48" height="30" viewBox="0 0 48 30" fill="none" xmlns="http://www.w3.org/2000/svg" {...props}>
            <circle cx="15" cy="15" r="10" fill="#EA001B"/>
            <circle cx="33" cy="15" r="10" fill="#F79E1B"/>
            <path d="M24 15a10 10 0 0 1-5.02-1.42A10 10 0 0 0 24 5a10 10 0 0 0 0 20 10 10 0 0 0 5.02-8.58A10 10 0 0 1 24 15z" fill="#FF5F00"/>
        </svg>
    )
}

export function ChipIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg 
        xmlns="http://www.w3.org/2000/svg" 
        width="50" 
        height="50" 
        viewBox="0 0 50 50"
        {...props}
    >
        <image href={logo.src}
        width="50"
        height="50"
        clipPath="url(#clip)"
      />
     <defs>
        <clipPath id="clip">
            <rect width="50" height="50" rx="10" />
        </clipPath>
    </defs>
    </svg>
  );
}
