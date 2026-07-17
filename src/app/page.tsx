"use client"

import { useEffect, useRef, useState } from "react"
import type React from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { supabase } from "@/lib/supabase"
import { useCart } from "@/lib/cart"
import { useClienteAuth } from "@/lib/auth-cliente"
import { useIsMobile } from "@/lib/use-mobile"
import type { Loja, CategoriaLoja } from "@/types"
import { LogoClean } from "@/components/LogoClean"
import { MobileBottomNav } from "@/components/MobileBottomNav"
import AddressBottomSheet from "@/components/AddressBottomSheet"
import ModalCompletarPerfil from "@/components/ModalCompletarPerfil"

const CAT_IMG: Record<string, string> = {
  Restaurante: "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f354.png",
  Mercadinho:  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f6d2.png",
  "Farmácia":  "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f48a.png",
  Outros:      "https://cdn.jsdelivr.net/gh/twitter/twemoji@14.0.2/assets/72x72/1f35d.png",
}
const CAT_DISPLAY: Record<string, string> = {
  Restaurante: "Restaurantes",
  Mercadinho:  "Mercados",
  "Farmácia":  "Farmácias",
  Outros:      "Outros",
}
const CAT_COLORS: Record<string, { bg: string; text: string; accent: string }> = {
  Restaurante: { bg: "#fff4ee", text: "#c2410c", accent: "#FF6B00" },
  Mercadinho:  { bg: "#f0fdf4", text: "#15803d", accent: "#22c55e" },
  "Farmácia":  { bg: "#eff6ff", text: "#1d4ed8", accent: "#3b82f6" },
  Outros:      { bg: "#f5f3ff", text: "#6d28d9", accent: "#8b5cf6" },
}
const CATEGORIAS: CategoriaLoja[] = ["Restaurante", "Mercadinho", "Farmácia", "Outros"]

type HomeCatAction = "filter" | "busca" | "breve"
const CATS_HOME: { label: string; icon: React.ReactNode; img?: string; bg: string; cat: CategoriaLoja | null; badge: string | null; action: HomeCatAction }[] = [
  {
    label: "Restaurantes",
    bg: "linear-gradient(145deg,#FF5722,#E64A19)",
    img: "/icons/restaurantes.svg",
    cat: "Restaurante", badge: null, action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Sesame bun top */}
        <ellipse cx="18" cy="10" rx="13" ry="7" fill="#D4A055"/>
        <ellipse cx="18" cy="9" rx="13" ry="6.5" fill="#E8B96A"/>
        <ellipse cx="18" cy="8.5" rx="12" ry="5.5" fill="#F5CA82"/>
        {/* Sesame seeds */}
        <ellipse cx="13" cy="7" rx="1.5" ry="0.9" fill="#C08040" transform="rotate(-15 13 7)"/>
        <ellipse cx="18" cy="6" rx="1.5" ry="0.9" fill="#C08040"/>
        <ellipse cx="23" cy="7" rx="1.5" ry="0.9" fill="#C08040" transform="rotate(15 23 7)"/>
        <ellipse cx="15.5" cy="9.5" rx="1.2" ry="0.7" fill="#C08040" transform="rotate(-10 15.5 9.5)"/>
        <ellipse cx="20.5" cy="9.5" rx="1.2" ry="0.7" fill="#C08040" transform="rotate(10 20.5 9.5)"/>
        {/* Lettuce layer */}
        <path d="M5 17 Q9 14 12 16 Q15 13 18 16 Q21 13 24 16 Q27 14 31 17 L31 19 Q27 17 24 19 Q21 16 18 19 Q15 16 12 19 Q9 17 5 19 Z" fill="#4CAF50"/>
        <path d="M5 17 Q9 15 12 17 Q15 14 18 17 Q21 14 24 17 Q27 15 31 17" fill="none" stroke="#388E3C" strokeWidth="0.5"/>
        {/* Tomato layer */}
        <rect x="5" y="18.5" width="26" height="3.5" rx="1.5" fill="#E53935"/>
        <ellipse cx="10" cy="20.2" rx="2" ry="1.5" fill="#EF5350"/>
        <ellipse cx="18" cy="20.2" rx="2" ry="1.5" fill="#EF5350"/>
        <ellipse cx="26" cy="20.2" rx="2" ry="1.5" fill="#EF5350"/>
        {/* Cheese slice */}
        <rect x="4" y="21.5" width="28" height="2.5" rx="1" fill="#FDD835"/>
        <path d="M29 21.5 L32 24 L29 24 Z" fill="#F9A825"/>
        <path d="M7 21.5 L4 24 L7 24 Z" fill="#F9A825"/>
        {/* Beef patty */}
        <ellipse cx="18" cy="26" rx="13" ry="3.5" fill="#4E342E"/>
        <ellipse cx="18" cy="25.5" rx="12.5" ry="3" fill="#5D4037"/>
        <ellipse cx="14" cy="25" rx="2" ry="1.2" fill="#4E342E"/>
        <ellipse cx="21" cy="25" rx="2.5" ry="1.2" fill="#4E342E"/>
        {/* Bun bottom */}
        <ellipse cx="18" cy="29.5" rx="13" ry="4" fill="#D4A055"/>
        <ellipse cx="18" cy="29" rx="12.5" ry="3.2" fill="#E8B96A"/>
      </svg>
    ),
  },
  {
    label: "Mercados",
    bg: "linear-gradient(145deg,#E53935,#C62828)",
    img: "/icons/mercados.svg",
    cat: "Mercadinho", badge: null, action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Cart body frame */}
        <path d="M4 8 L7 8 L10 22 L28 22 L31 12 L10 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
        {/* Cart basket fill */}
        <path d="M10 12 L10 22 L28 22 L31 12 Z" fill="rgba(255,255,255,0.2)" stroke="white" strokeWidth="1.5"/>
        {/* Item: green pack */}
        <rect x="13" y="14" width="4" height="6" rx="1" fill="#4CAF50"/>
        <rect x="13.5" y="14.5" width="3" height="1.5" rx="0.5" fill="#81C784"/>
        {/* Item: red box */}
        <rect x="18" y="14.5" width="4" height="5.5" rx="1" fill="#EF5350"/>
        <rect x="18.5" y="15" width="3" height="1.2" rx="0.4" fill="#EF9A9A"/>
        {/* Item: yellow bag */}
        <path d="M23 16 Q23 14 25 14 Q27 14 27 16 L27 20 L23 20 Z" fill="#FDD835"/>
        <path d="M24 14.5 Q25 13 26 14.5" stroke="#F9A825" strokeWidth="1" fill="none"/>
        {/* Wheels */}
        <circle cx="14" cy="25" r="2.5" fill="white" stroke="#BDBDBD" strokeWidth="1"/>
        <circle cx="14" cy="25" r="1" fill="#9E9E9E"/>
        <circle cx="26" cy="25" r="2.5" fill="white" stroke="#BDBDBD" strokeWidth="1"/>
        <circle cx="26" cy="25" r="1" fill="#9E9E9E"/>
        {/* Handle */}
        <path d="M4 8 L7 8" stroke="white" strokeWidth="2.5" strokeLinecap="round"/>
        <circle cx="4" cy="8" r="1.5" fill="#ECEFF1"/>
      </svg>
    ),
  },
  {
    label: "Farmácias",
    bg: "linear-gradient(145deg,#1E88E5,#1565C0)",
    img: "/icons/farmacias.svg",
    cat: "Farmácia", badge: null, action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Large capsule pill — left half red, right half white */}
        <rect x="4" y="14" width="28" height="12" rx="6" fill="white" stroke="#90CAF9" strokeWidth="1"/>
        <path d="M4 14 Q4 26 10 26 L10 14 Q7 14 4 17 Z" fill="#E53935"/>
        <path d="M4 20 Q4 14 10 14 L10 26 Q4 26 4 20 Z" fill="#E53935"/>
        {/* Dividing line between halves */}
        <line x1="10" y1="14" x2="10" y2="26" stroke="#90CAF9" strokeWidth="0.8"/>
        {/* Highlight on pill */}
        <ellipse cx="17" cy="16.5" rx="6" ry="1.5" fill="rgba(255,255,255,0.5)"/>
        {/* Medical cross above */}
        <rect x="15" y="3" width="6" height="10" rx="1.5" fill="#4CAF50"/>
        <rect x="12" y="6" width="12" height="4" rx="1.5" fill="#4CAF50"/>
        <rect x="16" y="4" width="4" height="8" rx="1" fill="#81C784"/>
        <rect x="13" y="7" width="10" height="2" rx="1" fill="#81C784"/>
        {/* Reflection on capsule */}
        <ellipse cx="23" cy="16.5" rx="3.5" ry="1.2" fill="rgba(255,255,255,0.4)"/>
        {/* Bottom dots / label lines */}
        <line x1="13" y1="22" x2="28" y2="22" stroke="#90CAF9" strokeWidth="0.8" strokeDasharray="2,2"/>
      </svg>
    ),
  },
  {
    label: "Gourmet",
    bg: "linear-gradient(145deg,#4E342E,#6D4C41)",
    img: "/icons/gourmet.svg",
    cat: "Restaurante", badge: "Novo", action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Plate shadow */}
        <ellipse cx="18" cy="30" rx="13" ry="2.5" fill="rgba(0,0,0,0.25)"/>
        {/* Plate */}
        <circle cx="18" cy="22" r="13" fill="#F5F5F5"/>
        <circle cx="18" cy="22" r="11.5" fill="white"/>
        <circle cx="18" cy="22" r="7" fill="#FAFAFA" stroke="#E0E0E0" strokeWidth="0.5"/>
        {/* Decorative food center — herb + red berry */}
        <circle cx="18" cy="22" r="3" fill="#E8F5E9"/>
        <ellipse cx="18" cy="22" rx="2" ry="1" fill="#A5D6A7"/>
        {/* Herb sprigs */}
        <path d="M16 21 Q17 19 18 21" stroke="#388E3C" strokeWidth="1" fill="none"/>
        <path d="M18 21 Q19 19 20 21" stroke="#388E3C" strokeWidth="1" fill="none"/>
        <circle cx="16.5" cy="20.2" r="0.8" fill="#4CAF50"/>
        <circle cx="19.5" cy="20.2" r="0.8" fill="#4CAF50"/>
        {/* Red berry / garnish */}
        <circle cx="18" cy="20.5" r="1.2" fill="#E53935"/>
        <path d="M18 19.3 Q18.3 18.5 18.8 19" stroke="#4CAF50" strokeWidth="0.7" fill="none"/>
        {/* Fork on left */}
        <line x1="7" y1="12" x2="7" y2="29" stroke="#9E9E9E" strokeWidth="1.5" strokeLinecap="round"/>
        <line x1="5.5" y1="12" x2="5.5" y2="17" stroke="#9E9E9E" strokeWidth="1" strokeLinecap="round"/>
        <line x1="8.5" y1="12" x2="8.5" y2="17" stroke="#9E9E9E" strokeWidth="1" strokeLinecap="round"/>
        <path d="M5.5 17 Q7 19 8.5 17" stroke="#9E9E9E" strokeWidth="1" fill="none"/>
        {/* Knife on right */}
        <line x1="29" y1="12" x2="29" y2="29" stroke="#BDBDBD" strokeWidth="1.5" strokeLinecap="round"/>
        <path d="M29 12 Q32 14 31 18 Q30 20 29 20 L29 12 Z" fill="#BDBDBD"/>
        <path d="M29 13 Q31 15 30.5 18 Q30 19.5 29 19.5" stroke="#E0E0E0" strokeWidth="0.5" fill="none"/>
      </svg>
    ),
  },
  {
    label: "Pet Shops",
    bg: "linear-gradient(145deg,#AD1457,#E91E63)",
    img: "/icons/petshops.svg",
    cat: null, badge: null, action: "breve",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Large central pad */}
        <rect x="10" y="18" width="16" height="14" rx="8" fill="#D7A87A"/>
        <rect x="11" y="19" width="14" height="11" rx="7" fill="#E8C49A"/>
        {/* Top left toe */}
        <ellipse cx="9" cy="14" rx="3.5" ry="4.5" fill="#D7A87A"/>
        <ellipse cx="9" cy="14" rx="2.8" ry="3.8" fill="#E8C49A"/>
        {/* Top center-left toe */}
        <ellipse cx="14.5" cy="11" rx="3.5" ry="4.5" fill="#D7A87A"/>
        <ellipse cx="14.5" cy="11" rx="2.8" ry="3.8" fill="#E8C49A"/>
        {/* Top center-right toe */}
        <ellipse cx="21.5" cy="11" rx="3.5" ry="4.5" fill="#D7A87A"/>
        <ellipse cx="21.5" cy="11" rx="2.8" ry="3.8" fill="#E8C49A"/>
        {/* Top right toe */}
        <ellipse cx="27" cy="14" rx="3.5" ry="4.5" fill="#D7A87A"/>
        <ellipse cx="27" cy="14" rx="2.8" ry="3.8" fill="#E8C49A"/>
        {/* Central pad inner detail */}
        <ellipse cx="18" cy="24" rx="5" ry="4" fill="#C49060"/>
        <ellipse cx="18" cy="23.5" rx="4" ry="3" fill="#D7A87A"/>
      </svg>
    ),
  },
  {
    label: "Bebidas",
    bg: "linear-gradient(145deg,#0288D1,#0277BD)",
    img: "/icons/bebidas.svg",
    cat: null, badge: "Novo", action: "breve",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Glass body */}
        <path d="M10 8 L12 30 L24 30 L26 8 Z" fill="rgba(255,255,255,0.15)" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinejoin="round"/>
        {/* Liquid fill — amber/cola color */}
        <path d="M10.8 14 L12 30 L24 30 L25.2 14 Z" fill="#B8860B" opacity="0.85"/>
        <path d="M10.8 14 L25.2 14" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8"/>
        {/* Liquid surface highlight */}
        <ellipse cx="18" cy="14" rx="7.2" ry="1" fill="rgba(255,255,255,0.3)"/>
        {/* Ice cubes */}
        <rect x="12.5" y="16" width="4.5" height="4.5" rx="1" fill="rgba(200,235,255,0.7)" stroke="rgba(255,255,255,0.6)" strokeWidth="0.5"/>
        <rect x="18" y="18" width="4" height="4" rx="1" fill="rgba(200,235,255,0.6)" stroke="rgba(255,255,255,0.5)" strokeWidth="0.5"/>
        <rect x="13" y="21" width="3.5" height="3.5" rx="0.8" fill="rgba(200,235,255,0.5)" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5"/>
        {/* Bubbles */}
        <circle cx="15" cy="15.5" r="0.8" fill="rgba(255,255,255,0.6)"/>
        <circle cx="20" cy="15" r="0.6" fill="rgba(255,255,255,0.5)"/>
        <circle cx="22" cy="15.8" r="0.5" fill="rgba(255,255,255,0.4)"/>
        {/* Straw — red/white striped */}
        <rect x="21.5" y="4" width="2.5" height="24" rx="1.25" fill="white"/>
        <rect x="21.5" y="4" width="2.5" height="3" rx="1.25" fill="#E53935"/>
        <rect x="21.5" y="10" width="2.5" height="3" rx="0" fill="#E53935"/>
        <rect x="21.5" y="17" width="2.5" height="3" rx="0" fill="#E53935"/>
        <rect x="21.5" y="24" width="2.5" height="3" rx="0" fill="#E53935"/>
        {/* Glass highlights */}
        <path d="M11.5 9 L12.5 26" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
        <path d="M13 9 L13.5 14" stroke="rgba(255,255,255,0.3)" strokeWidth="0.7" strokeLinecap="round"/>
        {/* Base */}
        <path d="M12 30 L24 30" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    ),
  },
  {
    label: "Massas",
    bg: "linear-gradient(145deg,#F57F17,#E65100)",
    img: "/icons/massas.svg",
    cat: "Restaurante", badge: null, action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bowl shadow */}
        <ellipse cx="18" cy="31.5" rx="12" ry="2" fill="rgba(0,0,0,0.2)"/>
        {/* Bowl outer */}
        <path d="M5 19 Q5 32 18 32 Q31 32 31 19 Z" fill="#E3F2FD"/>
        <path d="M5 19 Q5 32 18 32 Q31 32 31 19 Z" fill="white"/>
        {/* Bowl rim */}
        <path d="M5 19 Q18 22 31 19" stroke="#90CAF9" strokeWidth="1.5" fill="none"/>
        <ellipse cx="18" cy="19" rx="13" ry="2.5" fill="#F5F5F5" stroke="#BBDEFB" strokeWidth="1"/>
        {/* Tomato sauce base */}
        <ellipse cx="18" cy="23" rx="10" ry="6" fill="#E53935" opacity="0.9"/>
        <ellipse cx="18" cy="23" rx="8.5" ry="5" fill="#EF5350"/>
        {/* Pasta swirls — golden spaghetti */}
        <path d="M10 22 Q12 18 14 22 Q16 26 18 22 Q20 18 22 22 Q24 26 26 22" stroke="#F5CA82" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M9 25 Q12 21 15 25 Q17 28 19 25 Q21 21 24 25 Q26 28 27 25" stroke="#E8B96A" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        <path d="M11 20 Q13 17 15 20 Q17 23 19 20 Q21 17 23 20 Q25 23 26 20" stroke="#F5CA82" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* Basil leaf on top */}
        <ellipse cx="18" cy="19.5" rx="3.5" ry="2" fill="#4CAF50" transform="rotate(-20 18 19.5)"/>
        <ellipse cx="18" cy="19.5" rx="2.8" ry="1.5" fill="#66BB6A" transform="rotate(-20 18 19.5)"/>
        <line x1="16.5" y1="20" x2="19.5" y2="19" stroke="#388E3C" strokeWidth="0.6"/>
        {/* Sauce drips */}
        <circle cx="13" cy="21" r="1.2" fill="#C62828"/>
        <circle cx="23" cy="21" r="1" fill="#C62828"/>
      </svg>
    ),
  },
  {
    label: "Lanches",
    bg: "linear-gradient(145deg,#6D4C41,#4E342E)",
    img: "/icons/lanches.svg",
    cat: "Restaurante", badge: null, action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Bun top */}
        <path d="M6 18 Q6 11 18 11 Q30 11 30 18 L30 20 L6 20 Z" fill="#D4A055"/>
        <path d="M6 18 Q6 12 18 12 Q30 12 30 18" fill="#E8B96A"/>
        <path d="M7 18 Q7 13 18 13 Q29 13 29 18" fill="#F5CA82" opacity="0.6"/>
        {/* Bun split / opening */}
        <rect x="5" y="19.5" width="26" height="2.5" rx="1" fill="#E8B96A"/>
        {/* Sausage / frank */}
        <path d="M7 20.5 Q7 17 18 17 Q29 17 29 20.5 Q29 24 18 24 Q7 24 7 20.5 Z" fill="#C44D33"/>
        <path d="M7.5 20 Q7.5 17.5 18 17.5 Q28.5 17.5 28.5 20" fill="#D4614A"/>
        {/* Sausage sheen */}
        <ellipse cx="18" cy="18.5" rx="8" ry="1.2" fill="rgba(255,255,255,0.2)"/>
        {/* Mustard zigzag */}
        <path d="M8 20 Q10 18 12 20 Q14 22 16 20 Q18 18 20 20 Q22 22 24 20 Q26 18 28 20" stroke="#FDD835" strokeWidth="1.8" fill="none" strokeLinecap="round"/>
        {/* Ketchup drip on side */}
        <path d="M27 23 Q28.5 24 28 26 Q27.5 27.5 27 27" stroke="#E53935" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <circle cx="27.2" cy="27.3" r="1.2" fill="#E53935"/>
        {/* Bun bottom */}
        <path d="M5 22 Q5 28 18 28 Q31 28 31 22 L31 22.5 L5 22.5 Z" fill="#D4A055"/>
        <path d="M5.5 23 Q5.5 28 18 28 Q30.5 28 30.5 23" fill="#E8B96A"/>
        {/* Sesame on bun top */}
        <ellipse cx="13" cy="14.5" rx="1.3" ry="0.7" fill="#C08040" transform="rotate(-10 13 14.5)"/>
        <ellipse cx="18" cy="13" rx="1.3" ry="0.7" fill="#C08040"/>
        <ellipse cx="23" cy="14.5" rx="1.3" ry="0.7" fill="#C08040" transform="rotate(10 23 14.5)"/>
      </svg>
    ),
  },
  {
    label: "Pizzarias",
    bg: "linear-gradient(145deg,#C62828,#B71C1C)",
    img: "/icons/pizzarias.svg",
    cat: "Restaurante", badge: null, action: "filter",
    icon: (
      <svg width="34" height="34" viewBox="0 0 36 36" fill="none" xmlns="http://www.w3.org/2000/svg">
        {/* Pizza slice — triangle pointing down */}
        <path d="M18 32 L4 10 L32 10 Z" fill="#FDD835"/>
        {/* Crust edge at top */}
        <path d="M4 10 Q18 5 32 10" fill="#D4A055"/>
        <path d="M4 10 Q18 6 32 10 Q18 8 4 10" fill="#E8B96A"/>
        {/* Tomato sauce red base */}
        <path d="M18 30 L6 12 L30 12 Z" fill="#E53935"/>
        {/* Cheese layer */}
        <path d="M18 28 L7.5 13.5 L28.5 13.5 Z" fill="#FDD835"/>
        <path d="M18 26 L9 15 L27 15 Z" fill="#F9CB40"/>
        {/* Cheese bubbles / texture */}
        <circle cx="16" cy="18" r="1.5" fill="#F9A825"/>
        <circle cx="21" cy="17" r="1.2" fill="#F9A825"/>
        <circle cx="14" cy="21" r="1" fill="#F9A825"/>
        <circle cx="20" cy="22" r="1.3" fill="#F9A825"/>
        {/* Pepperoni circles */}
        <circle cx="18" cy="19" r="2.8" fill="#8B1A1A"/>
        <circle cx="18" cy="19" r="2.4" fill="#C62828"/>
        <circle cx="18" cy="19" r="1" fill="#9B2335" opacity="0.6"/>
        <circle cx="13" cy="23" r="2.5" fill="#8B1A1A"/>
        <circle cx="13" cy="23" r="2.1" fill="#C62828"/>
        <circle cx="23" cy="23" r="2.5" fill="#8B1A1A"/>
        <circle cx="23" cy="23" r="2.1" fill="#C62828"/>
        <circle cx="18" cy="27" r="2" fill="#8B1A1A"/>
        <circle cx="18" cy="27" r="1.6" fill="#C62828"/>
        {/* Crust texture */}
        <path d="M6 11 Q18 7.5 30 11" stroke="#C08040" strokeWidth="0.8" fill="none"/>
        {/* Green herb dots */}
        <circle cx="15.5" cy="16.5" r="0.7" fill="#4CAF50"/>
        <circle cx="21" cy="20" r="0.7" fill="#4CAF50"/>
        <circle cx="17" cy="24" r="0.6" fill="#4CAF50"/>
      </svg>
    ),
  },
  {
    label: "Ver mais",
    bg: "linear-gradient(145deg,#546E7A,#78909C)",
    img: "/icons/ver-mais.svg",
    cat: null, badge: null, action: "busca",
    icon: (
      <svg width="28" height="28" viewBox="0 0 28 28" fill="white" xmlns="http://www.w3.org/2000/svg" opacity={0.9}>
        <rect x="3.5"  y="3.5"  width="6" height="6" rx="1.5"/>
        <rect x="11"   y="3.5"  width="6" height="6" rx="1.5"/>
        <rect x="18.5" y="3.5"  width="6" height="6" rx="1.5"/>
        <rect x="3.5"  y="11"   width="6" height="6" rx="1.5"/>
        <rect x="11"   y="11"   width="6" height="6" rx="1.5"/>
        <rect x="18.5" y="11"   width="6" height="6" rx="1.5"/>
        <rect x="3.5"  y="18.5" width="6" height="6" rx="1.5"/>
        <rect x="11"   y="18.5" width="6" height="6" rx="1.5"/>
        <rect x="18.5" y="18.5" width="6" height="6" rx="1.5"/>
      </svg>
    ),
  },
]

function playSound() {
  try {
    const audio = new Audio("/splash.mp3")
    audio.volume = 0.85
    audio.play().catch(() => {})
  } catch {}
}

const BANNERS = [
  {
    photo: "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=800&h=400&q=82",
    overlay: "linear-gradient(100deg,rgba(140,10,10,0.90) 0%,rgba(160,20,20,0.65) 50%,rgba(0,0,0,0.08) 100%)",
    shadow: "rgba(160,20,20,0.40)",
    cta_bg: "#DC2626",
    eyebrow: "Chegô Delivery",
    title: "Entrega Rápida",
    sub: "do seu restaurante favorito até você",
    cta: "Pedir agora →",
  },
  {
    photo: "https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?auto=format&fit=crop&w=800&h=400&q=82",
    overlay: "linear-gradient(100deg,rgba(55,10,110,0.90) 0%,rgba(75,15,140,0.65) 50%,rgba(0,0,0,0.08) 100%)",
    shadow: "rgba(75,15,140,0.40)",
    cta_bg: "#7C3AED",
    eyebrow: "Novidade",
    title: "Mais Rápido",
    sub: "entrega express em 30 min",
    cta: "Ver lojas →",
  },
  {
    photo: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=800&h=400&q=82",
    overlay: "linear-gradient(100deg,rgba(4,60,25,0.90) 0%,rgba(5,90,35,0.65) 50%,rgba(0,0,0,0.08) 100%)",
    shadow: "rgba(5,90,35,0.40)",
    cta_bg: "#16a34a",
    eyebrow: "Mercados",
    title: "Fresquinho",
    sub: "hortifruti direto na sua porta",
    cta: "Ver mercados →",
  },
]

function getGreeting() {
  const h = new Date().getHours()
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite"
}

export default function Home() {
  const router   = useRouter()
  const storeRef = useRef<HTMLDivElement>(null)
  const { count, total } = useCart()
  const { user, perfil, logout } = useClienteAuth()

  const [lojas,      setLojas]      = useState<Loja[]>([])
  const [loading,    setLoading]    = useState(true)
  const [filtro,     setFiltro]     = useState<string | null>(null)
  const [busca,      setBusca]      = useState("")
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const splashDone = typeof window !== "undefined" && !!sessionStorage.getItem("arago_splash_done")
  const [splashVis,  setSplashVis]  = useState(!splashDone)
  const [splashFade, setSplashFade] = useState(false)
  const [menuAberto, setMenuAberto] = useState(false)
  const [lastAddress, setLastAddress] = useState("Aragoiânia, GO")
  const [addrSheetOpen, setAddrSheetOpen] = useState(false)
  const [breveToast, setBreveToast] = useState(false)
  const [bannerIdx, setBannerIdx] = useState(0)
  const touchStartX = useRef(0)
  // step: 0=nenhum 1=hamburguer 2=carrinho 3=farmácia 4=logo
  const [step, setStep] = useState(0)
  const [splashStarted, setSplashStarted] = useState(false)
  const splashTimers = useRef<ReturnType<typeof setTimeout>[]>([])
  const [pedidoAtivo, setPedidoAtivo] = useState<{ codigo: string; id: string } | null>(null)

  const isMobile    = useIsMobile()
  const primeiroNome = perfil?.nome?.split(" ")[0] ?? user?.user_metadata?.name?.split(" ")[0] ?? null

  useEffect(() => {
    // Rastreia acesso ao app — máximo 1 vez a cada 30 min por dispositivo
    const KEY = "arago_last_acesso"
    const last = Number(localStorage.getItem(KEY) ?? 0)
    if (Date.now() - last > 30 * 60 * 1000) {
      fetch("/api/tracking/evento", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tipo: "acesso" }),
      }).catch(() => {})
      localStorage.setItem(KEY, String(Date.now()))
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("arago_last_address")
      if (saved) setLastAddress(saved)
      const ativo = localStorage.getItem("arago_pedido_ativo")
      if (ativo) {
        try { setPedidoAtivo(JSON.parse(ativo)) } catch {}
      }
      // Tenta obter localização do cliente: endereço salvo → GPS → sem coordenadas
      try {
        const endSalvo = localStorage.getItem("arago_endereco_salvo")
        if (endSalvo) {
          const addr = JSON.parse(endSalvo)
          if (addr.lat && addr.lng && addr.lat !== 0 && addr.lng !== 0) {
            setUserCoords({ lat: addr.lat, lng: addr.lng })
            return
          }
        }
      } catch {}
      // Se não há endereço salvo, tenta GPS silenciosamente
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          pos => setUserCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
          () => { /* sem GPS — não mostra distância */ },
          { enableHighAccuracy: false, timeout: 6000, maximumAge: 300000 }
        )
      }
    }
  }, [])

  function iniciarSplash() {
    if (splashStarted) return
    setSplashStarted(true)
    playSound()
    const mk = (fn: () => void, ms: number) => setTimeout(fn, ms)
    splashTimers.current = [
      mk(() => setStep(1),                                              0),
      mk(() => setStep(0),                                            800),
      mk(() => setStep(2),                                           1050),
      mk(() => setStep(0),                                           1850),
      mk(() => setStep(3),                                           2100),
      mk(() => setStep(0),                                           2900),
      mk(() => setStep(4),                                           3150),
      mk(() => setSplashFade(true),                                  4650),
      mk(() => { setSplashVis(false); sessionStorage.setItem("arago_splash_done", "1") }, 5250),
    ]
  }

  useEffect(() => {
    if (typeof window !== "undefined" && !localStorage.getItem("arago_onboarded")) {
      router.replace("/onboarding"); return
    }
    supabase.from("lojas").select("*").eq("status", "ativo")
      .order("aberto", { ascending: false }).order("nome")
      .then(({ data }) => { setLojas((data as Loja[]) ?? []); setLoading(false) })

    // Splash já foi exibido nesta sessão — fecha imediatamente
    if (sessionStorage.getItem("arago_splash_done")) { setSplashVis(false); return }

    // Inicia splash automaticamente sem exigir toque
    iniciarSplash()

    return () => splashTimers.current.forEach(clearTimeout)
  }, [])

  useEffect(() => {
    const id = setInterval(() => setBannerIdx(i => (i + 1) % BANNERS.length), 4000)
    return () => clearInterval(id)
  }, [])

  function scrollToLojas() {
    storeRef.current?.scrollIntoView({ behavior: "smooth", block: "start" })
  }
  function selectCat(cat: string | null) {
    setFiltro(f => f === cat ? null : cat)
    setTimeout(scrollToLojas, 80)
  }
  function handleHomeCat(c: typeof CATS_HOME[0]) {
    if (c.action === "filter" && c.cat) {
      // Sempre ativa o filtro, nunca faz toggle — evita desligar ao clicar
      // em duas subcategorias que mapeiam para o mesmo cat (ex: Gourmet + Pizzarias → Restaurante)
      setFiltro(c.cat)
      setTimeout(scrollToLojas, 80)
    } else if (c.action === "busca") {
      router.push("/busca")
    } else {
      setBreveToast(true)
      setTimeout(() => setBreveToast(false), 2200)
    }
  }

  const filtradas = lojas.filter(l => {
    const matchCat   = !filtro || l.categoria === filtro
    const matchBusca = l.nome.toLowerCase().includes(busca.toLowerCase())
    return matchCat && matchBusca
  })
  const abertas  = filtradas.filter(l => l.aberto)
  const fechadas = filtradas.filter(l => !l.aberto)

  return (
    <div style={{ minHeight: "100vh", background: "#F9FAFB", overflowX: "hidden" }}>

      {/* ── BANNER PEDIDO ATIVO ────────────────────────────── */}
      {pedidoAtivo && !splashVis && (
        <a href={`/pedido/${pedidoAtivo.codigo}`} style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          background: "#DC2626", color: "white", padding: "12px 20px",
          textDecoration: "none", gap: 12,
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 2px 12px rgba(220,38,38,0.35)",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: "white", animation: "pulse 1.5s infinite" }} />
            <span style={{ fontWeight: 700, fontSize: 14 }}>Pedido #{pedidoAtivo.codigo} em andamento</span>
          </div>
          <span style={{ fontWeight: 700, fontSize: 13, opacity: 0.9 }}>Acompanhar →</span>
        </a>
      )}

      {/* ── SPLASH ─────────────────────────────────────────── */}
      {splashVis && (
        <div
          onClick={iniciarSplash}
          style={{
            position: "fixed", inset: 0, zIndex: 9999, background: "#ffffff",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
            opacity: splashFade ? 0 : 1, transition: "opacity 0.6s ease",
            pointerEvents: splashFade ? "none" : "all",
            cursor: splashStarted ? "default" : "pointer",
            userSelect: "none",
          }}>
          {/* Partículas de fundo */}
          <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
            {Array.from({ length: 12 }).map((_, i) => (
              <div key={i} style={{
                position: "absolute", width: 5, height: 5, borderRadius: "50%",
                background: i % 3 === 0 ? "#DC2626" : i % 3 === 1 ? "rgba(220,38,38,0.2)" : "rgba(0,0,0,0.05)",
                left: `${(i * 8.3 + 5) % 100}%`, top: `${(i * 13 + 10) % 100}%`,
                animation: `splashFloat ${3 + (i % 3)}s ease-in-out ${i * 0.3}s infinite alternate`,
                opacity: step > 0 ? 1 : 0, transition: "opacity 0.5s",
              }} />
            ))}
          </div>

          <div style={{
            position: "absolute",
            width: 280, height: 280, borderRadius: "50%",
            background: "radial-gradient(circle, rgba(220,38,38,0.07) 0%, transparent 70%)",
            opacity: step > 0 && step < 4 ? 1 : 0,
            transform: step > 0 && step < 4 ? "scale(1)" : "scale(0.6)",
            transition: "opacity 0.4s, transform 0.4s",
          }} />

          <div style={{ position: "relative", width: 200, height: 200, perspective: "600px" }}>
            <img src="https://cdn-icons-png.flaticon.com/512/3075/3075977.png" alt="Restaurantes" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
              opacity: step === 1 ? 1 : 0,
              transform: step === 1 ? "scale(1) translateY(0px)" : step < 1 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              filter: "drop-shadow(0 0 24px rgba(249,115,22,0.4))",
            }} />
            <img src="https://cdn-icons-png.flaticon.com/512/3081/3081559.png" alt="Mercados" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
              opacity: step === 2 ? 1 : 0,
              transform: step === 2 ? "scale(1) translateY(0px)" : step < 2 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              filter: "drop-shadow(0 0 24px rgba(34,197,94,0.4))",
            }} />
            <img src="https://cdn-icons-png.flaticon.com/512/2913/2913133.png" alt="Farmácias" style={{
              position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain",
              opacity: step === 3 ? 1 : 0,
              transform: step === 3 ? "scale(1) translateY(0px)" : step < 3 ? "scale(0.6) translateY(32px)" : "scale(0.6) translateY(-32px)",
              transition: "opacity 0.4s ease, transform 0.4s ease",
              filter: "drop-shadow(0 0 24px rgba(59,130,246,0.4))",
            }} />
            <div style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              transform: step === 4 ? "rotateY(0deg) scale(1)" : "rotateY(-90deg) scale(0.5)",
              opacity: step === 4 ? 1 : 0,
              transition: "transform 0.8s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.5s ease",
              transformStyle: "preserve-3d",
              filter: step === 4 ? "drop-shadow(0 0 24px rgba(220,38,38,0.3))" : "none",
            }}>
              <img src="/logo-chego.png" alt="Chegô" style={{ width: 180, height: 180, objectFit: "contain" }} />
            </div>
          </div>

          <p style={{
            marginTop: 32,
            fontSize: step === 4 ? 15 : 13,
            fontWeight: 700,
            letterSpacing: step === 4 ? 1 : 3,
            textTransform: step === 4 ? "none" : "uppercase",
            textAlign: "center",
            maxWidth: 280,
            opacity: step > 0 ? 1 : 0,
            transform: step > 0 ? "translateY(0px)" : "translateY(12px)",
            transition: "opacity 0.35s ease, transform 0.35s ease, font-size 0.3s ease",
            color: step === 1 ? "#f97316"
                 : step === 2 ? "#22c55e"
                 : step === 3 ? "#60a5fa"
                 : step === 4 ? "#374151"
                 : "transparent",
          }}>
            {step === 1 ? "Restaurantes"
           : step === 2 ? "Mercados"
           : step === 3 ? "Farmácias"
           : step === 4 ? "O primeiro aplicativo delivery de Aragoiânia"
           : ""}
          </p>


          <style>{`
            @keyframes splashFloat {
              from { transform: translateY(0px) rotate(0deg); }
              to   { transform: translateY(-18px) rotate(180deg); }
            }
            @keyframes splashPulse {
              0%, 100% { transform: scale(1); opacity: 0.7; }
              50%       { transform: scale(1.15); opacity: 1; }
            }
          `}</style>
        </div>
      )}

      {/* ── HEADER MOBILE (iFood-style) ─────────────────────── */}
      {isMobile && (
        <div style={{
          background: "white", position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 1px 8px rgba(0,0,0,0.08)",
        }}>
          <div style={{ padding: "12px 16px 6px" }}>
            {/* Row 1: Saudação + avatar */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <p style={{ color: "#6B7280", fontSize: 13, fontWeight: 500 }}>
                {getGreeting()}{primeiroNome ? `, ${primeiroNome}` : ""} 👋
              </p>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {count > 0 && !!user && (
                  <Link href="/carrinho" style={{
                    display: "flex", alignItems: "center", gap: 4,
                    padding: "5px 10px", borderRadius: 8,
                    background: "#DC2626", color: "white", fontWeight: 700, fontSize: 12, textDecoration: "none",
                  }}>
                    🛒 {count}
                  </Link>
                )}
                {user ? (
                  <div style={{ position: "relative" }}>
                    {menuAberto && (
                      <div onClick={() => setMenuAberto(false)}
                        style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                    )}
                    <button onClick={() => setMenuAberto(v => !v)}
                      style={{ background: "none", border: "none", cursor: "pointer", padding: 2 }}>
                      {user.user_metadata?.avatar_url
                        ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 30, height: 30, borderRadius: "50%", objectFit: "cover" }} />
                        : <div style={{ width: 30, height: 30, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center" }}>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </div>}
                    </button>
                    {/* Mobile dropdown */}
                    <div style={{
                      position: "fixed", top: 64, right: 8,
                      background: "white", borderRadius: 16,
                      boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                      border: "1px solid #f0f0f0",
                      width: "calc(100vw - 16px)", maxWidth: 300, overflow: "hidden", zIndex: 200,
                      opacity: menuAberto ? 1 : 0,
                      transform: menuAberto ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
                      pointerEvents: menuAberto ? "all" : "none",
                      transition: "opacity 0.18s ease, transform 0.18s ease",
                    }}>
                      <div style={{ padding: "12px 14px", background: "#FFF8F5", borderBottom: "1px solid #f5ebe8", display: "flex", gap: 10, alignItems: "center" }}>
                        {user.user_metadata?.avatar_url
                          ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                          : <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                            </div>}
                        <div style={{ minWidth: 0 }}>
                          <p style={{ fontWeight: 700, fontSize: 13, color: "#1a1a1a" }}>{primeiroNome ?? "Meu perfil"}</p>
                          <p style={{ fontSize: 11, color: "#9ca3af", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{user.email}</p>
                        </div>
                      </div>
                      {[
                        { label: "Alterar dados",       href: "/cliente/alterar-dados" },
                        { label: "Ver meu perfil",      href: "/cliente/meu-perfil" },
                        { label: "Histórico de pedidos",href: "/cliente/historico" },
                        { label: "Convide e ganhe",     href: "/cliente/convide" },
                        { label: "Notificações",        href: "/cliente/notificacoes" },
                      ].map(({ label, href }) => (
                        <Link key={label} href={href} onClick={() => setMenuAberto(false)}
                          style={{ display: "block", padding: "10px 14px", textDecoration: "none", color: "#374151", fontSize: 13, fontWeight: 500, borderBottom: "1px solid #fafafa" }}>
                          {label}
                        </Link>
                      ))}
                      <button
                        onClick={async () => { setMenuAberto(false); await logout(); router.push("/") }}
                        style={{ width: "100%", padding: "10px 14px", border: "none", background: "none", textAlign: "left", color: "#DC2626", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
                        Sair da conta
                      </button>
                    </div>
                  </div>
                ) : (
                  <Link href="/cliente/entrar" style={{ background: "#DC2626", color: "white", fontSize: 12, fontWeight: 700, padding: "6px 14px", borderRadius: 8, textDecoration: "none" }}>
                    Entrar
                  </Link>
                )}
              </div>
            </div>

            {/* Endereço — clicável */}
            <button onClick={() => setAddrSheetOpen(true)} style={{
              display: "flex", alignItems: "center", gap: 6, marginBottom: 10,
              background: "none", border: "none", cursor: "pointer", padding: 0, width: "100%", textAlign: "left",
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              <span style={{ color: "#111827", fontWeight: 700, fontSize: 14, flex: 1 }}>
                {lastAddress.length > 32 ? lastAddress.substring(0, 30) + "..." : lastAddress}
              </span>
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>

          {/* Barra de busca mobile */}
          <div style={{ padding: "0 14px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F3F4F6", borderRadius: 12, padding: "10px 14px" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={busca}
                onChange={e => setBusca(e.target.value)}
                placeholder="Buscar restaurante ou produto..."
                style={{ flex: 1, background: "none", border: "none", outline: "none", fontSize: 14, color: "#374151" }}
              />
            </div>
          </div>
        </div>
      )}

      {/* ── NAVBAR DESKTOP ─────────────────────────────────── */}
      {!isMobile && (
        <nav style={{
          background: "rgba(255,255,255,0.97)",
          backdropFilter: "blur(12px)",
          WebkitBackdropFilter: "blur(12px)",
          borderBottom: "1px solid #e5e7eb",
          position: "sticky", top: 0, zIndex: 100,
          boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
        }}>
          <div style={{
            maxWidth: 1200, margin: "0 auto", padding: "0 24px",
            height: 80, display: "flex", alignItems: "center", gap: 8,
          }}>
            <Link href="/" style={{ textDecoration: "none", flexShrink: 0, marginRight: 20, display: "flex", alignItems: "center" }}>
              <img src="/logo-original.jpg" alt="Chegô" style={{ height: 60, width: "auto", objectFit: "contain", display: "block", borderRadius: 8 }} />
            </Link>

            <div style={{ display: "flex", gap: 4, flex: 1 }}>
              {[
                { label: "Restaurantes", cat: "Restaurante" },
                { label: "Mercados",     cat: "Mercadinho"  },
                { label: "Farmácias",    cat: "Farmácia"    },
              ].map(({ label, cat }) => (
                <button key={cat} onClick={() => selectCat(cat)}
                  style={{
                    background: filtro === cat ? "rgba(220,38,38,0.08)" : "transparent",
                    border: filtro === cat ? "1px solid rgba(220,38,38,0.3)" : "1px solid transparent",
                    borderRadius: 10, padding: "8px 16px", cursor: "pointer",
                    color: filtro === cat ? "#DC2626" : "#374151",
                    fontWeight: 500, fontSize: 15,
                  }}>
                  {label}
                </button>
              ))}
            </div>

            <div style={{ display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
              {count > 0 && !!user && (
                <Link href="/carrinho" style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 12,
                  background: "#DC2626", color: "white", fontWeight: 700, fontSize: 13, textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(220,38,38,0.3)",
                }}>
                  🛒 {count} · R$ {total.toFixed(2)}
                </Link>
              )}
              <Link href="/cadastro-loja" style={{
                padding: "8px 16px", borderRadius: 12,
                color: "#374151", fontWeight: 600, fontSize: 14, textDecoration: "none",
              }}>
                Anuncie sua loja
              </Link>

              {user ? (
                <div style={{ position: "relative" }}>
                  {menuAberto && (
                    <div onClick={() => setMenuAberto(false)}
                      style={{ position: "fixed", inset: 0, zIndex: 199 }} />
                  )}
                  <button onClick={() => setMenuAberto(v => !v)} style={{
                    display: "flex", alignItems: "center", gap: 8,
                    padding: "8px 14px", borderRadius: 12, cursor: "pointer",
                    background: "rgba(0,0,0,0.04)", border: "1px solid #e5e7eb",
                    color: "#374151", fontWeight: 600, fontSize: 13,
                  }}>
                    {user.user_metadata?.avatar_url
                      ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 26, height: 26, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                      : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>}
                    <span>Minha conta</span>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <polyline points={menuAberto ? "18 15 12 9 6 15" : "6 9 12 15 18 9"} />
                    </svg>
                  </button>

                  <div style={{
                    position: "absolute", top: "calc(100% + 6px)", right: 0,
                    background: "white", borderRadius: 16,
                    boxShadow: "0 12px 40px rgba(0,0,0,0.14)",
                    border: "1px solid #f0f0f0",
                    minWidth: 230, overflow: "hidden", zIndex: 200,
                    opacity: menuAberto ? 1 : 0,
                    transform: menuAberto ? "translateY(0) scale(1)" : "translateY(-8px) scale(0.97)",
                    pointerEvents: menuAberto ? "all" : "none",
                    transition: "opacity 0.18s ease, transform 0.18s ease",
                  }}>
                    <div style={{ padding: "14px 16px", background: "#FFF8F5", borderBottom: "1px solid #f5ebe8", display: "flex", gap: 12, alignItems: "center" }}>
                      {user.user_metadata?.avatar_url
                        ? <img src={user.user_metadata.avatar_url} alt="" style={{ width: 42, height: 42, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />
                        : <div style={{ width: 42, height: 42, borderRadius: "50%", background: "#FEE2E2", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
                          </div>}
                      <div style={{ minWidth: 0 }}>
                        <p style={{ fontWeight: 700, fontSize: 14, color: "#1a1a1a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {primeiroNome ?? "Meu perfil"}
                        </p>
                        <p style={{ fontSize: 12, color: "#9ca3af", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{user.email}</p>
                      </div>
                    </div>

                    {[
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>, label: "Alterar dados",        href: "/cliente/alterar-dados" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>, label: "Ver meu perfil",       href: "/cliente/meu-perfil" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>, label: "Configurações",        href: "/cliente/configuracoes" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, label: "Histórico de pedidos", href: "/cliente/historico" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, label: "Convide e ganhe",      href: "/cliente/convide" },
                      { icon: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>, label: "Notificações",         href: "/cliente/notificacoes" },
                    ].map(({ icon, label, href }) => (
                      <Link key={label} href={href}
                        onClick={() => setMenuAberto(false)}
                        style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 16px", textDecoration: "none", color: "#374151", fontSize: 14, fontWeight: 500, borderBottom: "1px solid #fafafa" }}
                        onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#FFF8F5"; (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                        onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = ""; (e.currentTarget as HTMLAnchorElement).style.color = "#374151" }}>
                        <span style={{ color: "#6B7280", flexShrink: 0, display: "flex" }}>{icon}</span>
                        {label}
                      </Link>
                    ))}

                    <button
                      onClick={async () => { setMenuAberto(false); await logout(); router.push("/") }}
                      style={{ width: "100%", padding: "12px 16px", border: "none", background: "none", textAlign: "left", color: "#DC2626", fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 }}
                      onMouseEnter={e => { e.currentTarget.style.background = "#fff5f5" }}
                      onMouseLeave={e => { e.currentTarget.style.background = "" }}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                      Sair da conta
                    </button>
                  </div>
                </div>
              ) : (
                <Link href="/cliente/entrar" style={{
                  display: "flex", alignItems: "center", gap: 7,
                  padding: "8px 18px", borderRadius: 12,
                  background: "#DC2626", border: "none",
                  color: "white", fontWeight: 600, fontSize: 13, textDecoration: "none",
                  boxShadow: "0 4px 12px rgba(220,38,38,0.35)",
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#B91C1C" }}
                onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.background = "#DC2626" }}>
                  Entrar
                </Link>
              )}
            </div>
          </div>
        </nav>
      )}

      {/* ── HERO (desktop only) ─────────────────────────────── */}
      {!isMobile && (
        <div style={{
          background: "linear-gradient(135deg, #B91C1C 0%, #DC2626 40%, #EF4444 75%, #F87171 100%)",
          minHeight: 420,
          display: "flex", alignItems: "center", justifyContent: "center",
          position: "relative", overflow: "hidden",
          padding: "56px 24px",
        }}>
          <div style={{ position: "absolute", top: -80, right: -80, width: 320, height: 320, borderRadius: "50%", background: "rgba(255,255,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", bottom: -60, left: -60, width: 240, height: 240, borderRadius: "50%", background: "rgba(255,255,255,0.04)", pointerEvents: "none" }} />

          <div style={{ maxWidth: 640, width: "100%", textAlign: "center", position: "relative", zIndex: 1 }}>
            <h1 style={{
              color: "white", fontWeight: 800,
              fontSize: "clamp(2rem, 4vw, 3rem)",
              lineHeight: 1.15, marginBottom: 14,
              textShadow: "0 2px 8px rgba(0,0,0,0.15)",
            }}>
              {primeiroNome ? `Olá, ${primeiroNome}! 👋` : "Chegô. O delivery de Aragoiânia."}
            </h1>
            <p style={{ color: "rgba(255,255,255,0.9)", fontSize: "1.1rem", lineHeight: 1.6, marginBottom: 36, fontWeight: 400 }}>
              Peça da sua loja favorita e receba em casa rapidinho.
            </p>
            {/* Botão de endereço de entrega */}
            <button
              onClick={() => setAddrSheetOpen(true)}
              style={{
                display: "inline-flex", alignItems: "center", gap: 8,
                background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)",
                borderRadius: 12, padding: "8px 18px", cursor: "pointer",
                color: "white", fontWeight: 600, fontSize: 14, marginBottom: 16,
                backdropFilter: "blur(8px)",
              }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
              </svg>
              {lastAddress.length > 40 ? lastAddress.substring(0, 38) + "..." : lastAddress}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>

            <div style={{
              maxWidth: 680, width: "90%", margin: "0 auto",
              borderRadius: 16, overflow: "hidden",
              boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
              display: "flex",
            }}>
              <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", background: "white" }}>
                <span style={{ padding: "0 16px", fontSize: 18, color: "#9CA3AF", flexShrink: 0, lineHeight: 1 }}>🔍</span>
                <input
                  value={busca}
                  onChange={e => setBusca(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") scrollToLojas() }}
                  placeholder="Buscar restaurante ou produto..."
                  style={{
                    flex: 1, height: 60, fontSize: 16, fontWeight: 500,
                    background: "transparent", border: "none", color: "#1a1a1a", outline: "none",
                    padding: "0 20px 0 0",
                  }}
                />
              </div>
              <button onClick={scrollToLojas} style={{
                height: 60, padding: "0 28px", border: "none",
                background: "#991B1B", color: "white",
                fontWeight: 700, fontSize: 16, cursor: "pointer", flexShrink: 0,
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "#7F1D1D" }}
              onMouseLeave={e => { e.currentTarget.style.background = "#991B1B" }}>
                Buscar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MAIN ───────────────────────────────────────────── */}
      <div style={{ maxWidth: isMobile ? "100%" : 1200, margin: "0 auto", padding: isMobile ? "0 0 80px" : "48px 24px 80px" }}>

        {/* Mobile: grade de categorias iFood 2×5 */}
        {isMobile && !busca && (
          <div style={{ background: "white", padding: "16px 8px 14px", borderBottom: "1px solid #f0f0f0", marginBottom: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px 0" }}>
              {CATS_HOME.map(c => {
                const isActive = !!(c.cat && filtro === c.cat)
                return (
                  <button key={c.label} onClick={() => handleHomeCat(c)} style={{
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                    background: "none", border: "none", cursor: "pointer", padding: "0 2px",
                  }}>
                    <div style={{ position: "relative" }}>
                      <div style={{
                        width: 58, height: 58, borderRadius: 16,
                        background: c.bg,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        boxShadow: isActive
                          ? "0 4px 14px rgba(0,0,0,0.35)"
                          : "0 2px 8px rgba(0,0,0,0.18)",
                        transform: isActive ? "scale(1.06)" : "scale(1)",
                        transition: "all 0.15s",
                        outline: isActive ? "2.5px solid rgba(255,255,255,0.8)" : "none",
                        outlineOffset: 1,
                      }}>
                        {c.img
                          ? <img
                              src={c.img}
                              alt={c.label}
                              width={46}
                              height={46}
                              style={{ objectFit: "contain", display: "block" }}
                              onError={e => { (e.currentTarget as HTMLImageElement).style.display = "none"; (e.currentTarget.nextSibling as HTMLElement | null)?.style.setProperty("display", "flex") }}
                            />
                          : null}
                        <span style={{ display: c.img ? "none" : "flex" }}>{c.icon}</span>
                      </div>
                      {c.badge && (
                        <span style={{
                          position: "absolute", top: -4, right: -4,
                          background: "#DC2626", color: "white",
                          fontSize: 8, fontWeight: 800,
                          padding: "2px 5px", borderRadius: 6, lineHeight: 1.3,
                          boxShadow: "0 1px 4px rgba(0,0,0,0.3)",
                        }}>
                          {c.badge}
                        </span>
                      )}
                    </div>
                    <span style={{
                      fontSize: 10, fontWeight: 600,
                      color: isActive ? "#DC2626" : "#374151",
                      textAlign: "center", lineHeight: 1.2,
                      width: "100%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
                    }}>
                      {c.label}
                    </span>
                  </button>
                )
              })}
            </div>
            {filtro && (
              <button onClick={() => setFiltro(null)} style={{ marginTop: 10, width: "100%", padding: "6px", borderRadius: 8, border: "1px dashed #d1d5db", background: "none", color: "#9CA3AF", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                ✕ Limpar filtro
              </button>
            )}
          </div>
        )}

        {/* Banner Promocional mobile */}
        {isMobile && !busca && !filtro && (() => {
          const b = BANNERS[bannerIdx]
          return (
            <div style={{ padding: "10px 16px 6px" }}>
              <div
                onClick={() => setBannerIdx(i => (i + 1) % BANNERS.length)}
                onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
                onTouchEnd={e => {
                  const dx = e.changedTouches[0].clientX - touchStartX.current
                  if (dx < -40)      setBannerIdx(i => (i + 1) % BANNERS.length)
                  else if (dx > 40)  setBannerIdx(i => (i - 1 + BANNERS.length) % BANNERS.length)
                }}
                style={{
                  borderRadius: 20, overflow: "hidden", cursor: "pointer",
                  position: "relative", height: 164,
                  boxShadow: `0 8px 28px ${b.shadow}`,
                  touchAction: "pan-y",
                }}>

                {/* Foto ultra-realista */}
                <img
                  key={bannerIdx}
                  src={b.photo}
                  alt={b.title}
                  style={{
                    position: "absolute", inset: 0,
                    width: "100%", height: "100%", objectFit: "cover",
                    animation: "bannerFadeIn 0.45s ease",
                  }}
                />

                {/* Overlay gradiente */}
                <div style={{ position: "absolute", inset: 0, background: b.overlay }} />

                {/* Conteúdo */}
                <div style={{ position: "relative", zIndex: 1, padding: "18px 20px", height: "100%", display: "flex", flexDirection: "column", justifyContent: "center" }}>
                  <p style={{ color: "rgba(255,255,255,0.78)", fontSize: 10, fontWeight: 800, textTransform: "uppercase", letterSpacing: 1.3, marginBottom: 4 }}>
                    {b.eyebrow}
                  </p>
                  <p style={{ color: "white", fontSize: 26, fontWeight: 900, lineHeight: 1.1, marginBottom: 4, textShadow: "0 2px 8px rgba(0,0,0,0.3)" }}>
                    {b.title}
                  </p>
                  <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 12, marginBottom: 14 }}>
                    {b.sub}
                  </p>
                  <div style={{
                    display: "inline-block", background: b.cta_bg,
                    padding: "7px 16px", borderRadius: 20, alignSelf: "flex-start",
                    boxShadow: "0 3px 10px rgba(0,0,0,0.25)",
                  }}>
                    <span style={{ color: "white", fontSize: 12, fontWeight: 800 }}>{b.cta}</span>
                  </div>
                </div>

                {/* Indicadores */}
                <div style={{ position: "absolute", bottom: 12, right: 18, display: "flex", gap: 5 }}>
                  {BANNERS.map((_, i) => (
                    <div key={i} style={{
                      width: i === bannerIdx ? 20 : 6, height: 6, borderRadius: 3,
                      background: i === bannerIdx ? "white" : "rgba(255,255,255,0.45)",
                      transition: "all 0.3s",
                    }} />
                  ))}
                </div>
              </div>
            </div>
          )
        })()}

        {/* Desktop: category chips */}
        {!isMobile && !busca && (
          <div style={{ marginBottom: 40 }}>
            <div className="cat-chips-wrap" style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
              {CATEGORIAS.map(cat => {
                const c     = CAT_COLORS[cat]
                const ativo = filtro === cat
                return (
                  <button key={cat} onClick={() => selectCat(cat)} style={{
                    display: "flex", alignItems: "center", gap: 10,
                    padding: "12px 22px", borderRadius: 50,
                    border: ativo ? `1.5px solid ${c.accent}` : "1.5px solid #e5e7eb",
                    background: ativo ? c.accent : "white",
                    color: ativo ? "white" : "#374151",
                    fontWeight: 600, fontSize: 14, cursor: "pointer",
                    boxShadow: ativo ? `0 6px 16px ${c.accent}44` : "0 4px 12px rgba(0,0,0,0.08)",
                    flexShrink: 0,
                  }}
                  onMouseEnter={e => {
                    if (!ativo) {
                      e.currentTarget.style.transform = "translateY(-3px)"
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.12)"
                      e.currentTarget.style.borderColor = "#FF6B00"
                    }
                  }}
                  onMouseLeave={e => {
                    if (!ativo) {
                      e.currentTarget.style.transform = ""
                      e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)"
                      e.currentTarget.style.borderColor = "#e5e7eb"
                    }
                  }}>
                    <img src={CAT_IMG[cat]} alt={cat} style={{ width: 24, height: 24, objectFit: "contain", filter: ativo ? "brightness(0) invert(1)" : "none" }} />
                    {CAT_DISPLAY[cat] ?? cat}
                  </button>
                )
              })}
              {filtro && (
                <button onClick={() => setFiltro(null)} style={{
                  padding: "12px 18px", borderRadius: 50, border: "1.5px dashed #d1d5db",
                  background: "transparent", color: "#9ca3af", fontWeight: 600, fontSize: 14, cursor: "pointer",
                  flexShrink: 0,
                }}>
                  ✕ Limpar
                </button>
              )}
            </div>
          </div>
        )}

        {/* Desktop: 2 cards grandes */}
        {!isMobile && !busca && !filtro && (
          <div style={{ marginBottom: 52 }}>
            <div style={{ marginBottom: 22 }}>
              <h2 style={{
                color: "#1a1a1a", fontWeight: 800, fontSize: "1.6rem",
                letterSpacing: "-0.5px",
                borderLeft: "4px solid #DC2626", paddingLeft: 12,
                lineHeight: 1.2,
              }}>
                O que você quer pedir?
              </h2>
              <p style={{ fontSize: 14, color: "#6B7280", marginTop: 6, paddingLeft: 16 }}>Escolha onde quer pedir</p>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
              <button onClick={() => selectCat("Restaurante")} style={{
                position: "relative", borderRadius: 20, overflow: "hidden",
                height: 200, cursor: "pointer", border: "none", textAlign: "left",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #FF6B00 0%, #E55A00 100%)",
                padding: 0, display: "block", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(255,107,0,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)" }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "45%", backgroundImage: "url(https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&q=85)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "60%", background: "linear-gradient(to right, #E55A00 0%, #FF6B0000 100%)" }} />
                <div style={{ position: "relative", zIndex: 1, padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: "65%" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Restaurantes</p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Comida pronta na sua porta</p>
                  </div>
                  <span style={{ display: "inline-flex", width: "fit-content", padding: "10px 20px", borderRadius: 12, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "white", fontWeight: 700, fontSize: 14 }}>
                    Ver opções ›
                  </span>
                </div>
              </button>

              <button onClick={() => selectCat("Mercadinho")} style={{
                position: "relative", borderRadius: 20, overflow: "hidden",
                height: 200, cursor: "pointer", border: "none", textAlign: "left",
                boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
                background: "linear-gradient(135deg, #16a34a 0%, #15803d 100%)",
                padding: 0, display: "block", width: "100%",
              }}
              onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 16px 40px rgba(34,197,94,0.35)" }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 8px 32px rgba(0,0,0,0.15)" }}>
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "45%", backgroundImage: "url(https://images.unsplash.com/photo-1542838132-92c53300491e?w=400&q=85)", backgroundSize: "cover", backgroundPosition: "center" }} />
                <div style={{ position: "absolute", right: 0, top: 0, bottom: 0, width: "60%", background: "linear-gradient(to right, #15803d 0%, #15803d00 100%)" }} />
                <div style={{ position: "relative", zIndex: 1, padding: "30px 32px", display: "flex", flexDirection: "column", justifyContent: "space-between", height: "100%", width: "65%" }}>
                  <div>
                    <p style={{ color: "white", fontWeight: 900, fontSize: 26, lineHeight: 1, marginBottom: 8 }}>Mercados</p>
                    <p style={{ color: "rgba(255,255,255,0.85)", fontSize: 14 }}>Produtos do dia a dia sem sair</p>
                  </div>
                  <span style={{ display: "inline-flex", width: "fit-content", padding: "10px 20px", borderRadius: 12, background: "rgba(0,0,0,0.25)", backdropFilter: "blur(8px)", WebkitBackdropFilter: "blur(8px)", color: "white", fontWeight: 700, fontSize: 14 }}>
                    Ver lojas ›
                  </span>
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Search mode filter chips */}
        {busca && (
          <div style={{ display: "flex", gap: 8, marginBottom: 24, flexWrap: "wrap", padding: isMobile ? "12px 16px 0" : "0" }}>
            {["Todas", ...CATEGORIAS].map(c => (
              <button key={c} onClick={() => setFiltro(c === "Todas" ? null : c)} style={{
                padding: "8px 16px", borderRadius: 50, fontSize: 13, fontWeight: 600, cursor: "pointer",
                background: (filtro === c || (c === "Todas" && !filtro)) ? "#DC2626" : "white",
                color:      (filtro === c || (c === "Todas" && !filtro)) ? "white" : "#6B7280",
                border: "1px solid #e5e7eb",
                boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
              }}>
                {c === "Todas" ? "🏪 Todas" : `${{ Restaurante:"🍔", Mercadinho:"🛒", "Farmácia":"💊", Outros:"🍝" }[c] ?? "📦"} ${c}`}
              </button>
            ))}
          </div>
        )}

        {/* ── LOJAS ──────────────────────────────────────────── */}
        <div ref={storeRef} style={{ padding: isMobile ? "0 0" : "0" }}>
          {(filtro || busca) && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20, padding: isMobile ? "12px 16px 0" : "0" }}>
              <h2 style={{ color: "#1a1a1a", fontWeight: 800, fontSize: 20 }}>
                {busca ? `Resultados para "${busca}"` : `${{ Restaurante:"🍔", Mercadinho:"🛒", "Farmácia":"💊", Outros:"🍝" }[filtro!] ?? "📦"} ${filtro}`}
              </h2>
              {filtro && (
                <button onClick={() => setFiltro(null)} style={{ background: "none", border: "none", color: "#9ca3af", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                  Limpar ✕
                </button>
              )}
            </div>
          )}

          {!filtro && !busca && (
            <div style={{ marginBottom: 8, padding: isMobile ? "12px 16px 4px" : "0", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <h2 style={{ color: "#111827", fontWeight: 900, fontSize: 20, display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 9, height: 9, borderRadius: "50%", background: "#22C55E", display: "inline-block", boxShadow: "0 0 0 3px rgba(34,197,94,0.25)" }} />
                Lojas abertas
              </h2>
              {isMobile && (
                <button onClick={() => router.push("/busca")} style={{ background: "none", border: "none", color: "#EA1B2D", fontSize: 13, fontWeight: 800, cursor: "pointer" }}>
                  Ver mais
                </button>
              )}
            </div>
          )}

          {loading ? (
            <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 0 : 20, padding: isMobile ? "0 0" : "0" }}>
              {[1,2,3,4].map(i => (
                <div key={i} style={{ background: "white", borderRadius: isMobile ? 0 : 16, height: 100, boxShadow: "var(--shadow-sm)", borderBottom: "1px solid #f0f0f0" }} />
              ))}
            </div>
          ) : filtradas.length === 0 ? (
            <div style={{ textAlign: "center", marginTop: 64, background: "white", borderRadius: 20, padding: "48px 24px", boxShadow: "var(--shadow-sm)", margin: isMobile ? "20px 16px" : undefined }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
              <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16 }}>Nenhuma loja encontrada</p>
              <p style={{ color: "#9ca3af", fontSize: 14, marginTop: 4 }}>Tente outro nome ou categoria</p>
            </div>
          ) : (
            <>
              {abertas.length > 0 && (
                <div style={{ marginBottom: isMobile ? 0 : 40 }}>
                  {(filtro || busca) && !isMobile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#22C55E" }} />
                      <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Abertas · {abertas.length} loja{abertas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 0 : 20 }}>
                    {abertas.map(loja => <LojaCard key={loja.id} loja={loja} isMobile={isMobile} userCoords={userCoords} />)}
                  </div>
                </div>
              )}
              {fechadas.length > 0 && (
                <div>
                  {!isMobile && (
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#d1d5db" }} />
                      <p style={{ color: "#d1d5db", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Fechadas · {fechadas.length} loja{fechadas.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                  )}
                  {isMobile && fechadas.length > 0 && (
                    <div style={{ padding: "12px 16px 4px" }}>
                      <p style={{ color: "#9ca3af", fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5 }}>Fechadas</p>
                    </div>
                  )}
                  <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))", gap: isMobile ? 0 : 20 }}>
                    {fechadas.map(loja => <LojaCard key={loja.id} loja={loja} isMobile={isMobile} userCoords={userCoords} />)}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── FOOTER (desktop only) ───────────────────────────── */}
      {!isMobile && (
        <footer style={{ background: "#f8fafc", borderTop: "1px solid #e5e7eb", color: "#374151", padding: "56px 24px 32px" }}>
          <div style={{ maxWidth: 1200, margin: "0 auto" }}>
            <div style={{ marginBottom: 40 }}>
              <LogoClean height={48} style={{ marginBottom: 12 }} />
              <p style={{ color: "#9CA3AF", fontSize: 14 }}>O delivery de Aragoiânia, GO</p>
            </div>
            <div className="footer-cols" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 40, marginBottom: 40 }}>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Parceiros</p>
                {[
                  { label: "Cadastrar minha loja", href: "/cadastro-loja" },
                  { label: "Portal de parceiros",  href: "/parceiros" },
                  { label: "Acesso lojista",        href: "/entrar" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} style={{ display: "block", color: "#6B7280", fontSize: 14, textDecoration: "none", marginBottom: 10, fontWeight: 400 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#6B7280" }}>
                    {label}
                  </Link>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Entregadores</p>
                {[
                  { label: "Quero ser motoboy",     href: "/cadastro-motoboy" },
                  { label: "Portal do entregador",  href: "/entrar/motoboy" },
                ].map(({ label, href }) => (
                  <Link key={href} href={href} style={{ display: "block", color: "#6B7280", fontSize: 14, textDecoration: "none", marginBottom: 10, fontWeight: 400 }}
                    onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#DC2626" }}
                    onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.color = "#6B7280" }}>
                    {label}
                  </Link>
                ))}
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Redes sociais</p>
                <a href="https://www.instagram.com/appchegodelivery?igsh=MW92Nnljcjdua2J0Zg==" target="_blank" rel="noopener noreferrer"
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, textDecoration: "none", padding: "10px 14px", borderRadius: 12, background: "#ffffff", border: "1px solid #e5e7eb" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <defs>
                      <radialGradient id="ig-grad" cx="30%" cy="107%" r="150%">
                        <stop offset="0%" stopColor="#fdf497"/><stop offset="5%" stopColor="#fdf497"/>
                        <stop offset="45%" stopColor="#fd5949"/><stop offset="60%" stopColor="#d6249f"/>
                        <stop offset="90%" stopColor="#285AEB"/>
                      </radialGradient>
                    </defs>
                    <rect x="2" y="2" width="20" height="20" rx="6" ry="6" fill="url(#ig-grad)"/>
                    <circle cx="12" cy="12" r="4.5" fill="none" stroke="white" strokeWidth="1.8"/>
                    <circle cx="17.5" cy="6.5" r="1.2" fill="white"/>
                  </svg>
                  <span style={{ color: "#374151", fontSize: 14, fontWeight: 500 }}>@AppChegoDelivery</span>
                </a>
              </div>
              <div>
                <p style={{ fontSize: 12, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "#9CA3AF", marginBottom: 16 }}>Localização</p>
                <p style={{ color: "#6B7280", fontSize: 14, lineHeight: 1.6 }}>Aragoiânia, Goiás</p>
              </div>
            </div>
            <div style={{ borderTop: "1px solid #e5e7eb", paddingTop: 24, display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
              <p style={{ color: "#9CA3AF", fontSize: 13 }}>© 2026 Chegô Delivery · Todos os direitos reservados</p>
              <p style={{ color: "#D1D5DB", fontSize: 12 }}>Feito com ❤️ em Aragoiânia</p>
            </div>
          </div>
        </footer>
      )}

      <MobileBottomNav />

      {/* Toast: em breve */}
      {breveToast && (
        <div style={{
          position: "fixed", bottom: 90, left: "50%", transform: "translateX(-50%)",
          background: "#111827", color: "white",
          padding: "10px 20px", borderRadius: 24,
          fontSize: 13, fontWeight: 700,
          boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
          zIndex: 9999, whiteSpace: "nowrap",
          maxWidth: "calc(100vw - 32px)",
          animation: "fadeInUp 0.2s ease",
        }}>
          🚀 Em breve no Chegô!
        </div>
      )}

      {/* Sheet de endereços — mobile e desktop */}
      {addrSheetOpen && (
        <AddressBottomSheet
          currentAddress={lastAddress}
          onSelect={addr => {
            setLastAddress(addr)
            try {
              const endSalvo = localStorage.getItem("arago_endereco_salvo")
              if (endSalvo) {
                const saved = JSON.parse(endSalvo)
                if (saved.lat && saved.lng && saved.lat !== 0 && saved.lng !== 0)
                  setUserCoords({ lat: saved.lat, lng: saved.lng })
              }
            } catch {}
          }}
          onClose={() => setAddrSheetOpen(false)}
        />
      )}

      {/* Modal de completar perfil — aparece após primeiro login sem CPF */}
      <ModalCompletarPerfil />
    </div>
  )
}

/* ── LOJA CARD ────────────────────────────────────────── */
function haversineKmCard(lat1: number, lng1: number, lat2: number, lng2: number) {
  const R = 6371
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

function LojaCard({ loja, isMobile, userCoords }: { loja: Loja; isMobile: boolean; userCoords?: { lat: number; lng: number } | null }) {
  const c = CAT_COLORS[loja.categoria] ?? CAT_COLORS["Outros"]
  const CAT_ICONS_LOCAL: Record<string, string> = {
    Restaurante: "🍔", Mercadinho: "🛒", "Farmácia": "💊", Outros: "📦",
  }

  const lojaLat = (loja as any).lat as number | null | undefined
  const lojaLng = (loja as any).lng as number | null | undefined
  const distKm = (userCoords && lojaLat && lojaLng && lojaLat !== 0 && lojaLng !== 0)
    ? haversineKmCard(userCoords.lat, userCoords.lng, lojaLat, lojaLng)
    : null
  const distLabel = distKm !== null
    ? distKm < 1 ? `${Math.round(distKm * 1000)} m` : `${distKm.toFixed(1)} km`
    : null

  if (isMobile) {
    return (
      <Link href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
        <div style={{
          background: "white", display: "flex", alignItems: "center", gap: 14,
          padding: "14px 16px", borderBottom: "1px solid #f0f0f0",
          opacity: loja.aberto ? 1 : 0.55,
        }}>
          {/* Thumb */}
          <div style={{
            width: 76, height: 76, borderRadius: 18, overflow: "hidden",
            flexShrink: 0, boxShadow: "0 3px 12px rgba(0,0,0,0.12)",
          }}>
            {loja.logo_url
              ? <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "contain", background: "white" }} />
              : <div style={{ width: "100%", height: "100%", background: loja.aberto ? `linear-gradient(135deg, ${c.accent}, ${c.accent}bb)` : "linear-gradient(135deg,#d1d5db,#9ca3af)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 32 }}>
                  {CAT_ICONS_LOCAL[loja.categoria]}
                </div>}
          </div>
          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{ color: "#111827", fontWeight: 800, fontSize: 15, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginBottom: 2 }}>{loja.nome}</p>
            <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 4 }}>
              {[1,2,3,4,5].map(s => {
                const nota = Number(loja.nota_media ?? 0)
                const filled = nota > 0 && nota >= s
                const half   = nota > 0 && !filled && nota >= s - 0.5
                return (
                  <svg key={s} width="12" height="12" viewBox="0 0 24 24" fill={filled ? "#f59e0b" : half ? "url(#mhstar)" : "#E5E7EB"} stroke="none">
                    <defs><linearGradient id="mhstar"><stop offset="50%" stopColor="#f59e0b"/><stop offset="50%" stopColor="#E5E7EB"/></linearGradient></defs>
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                )
              })}
              {loja.nota_media != null && loja.nota_media > 0 ? (
                <>
                  <span style={{ color: "#111827", fontWeight: 700, fontSize: 12, marginLeft: 2 }}>{Number(loja.nota_media).toFixed(1)}</span>
                  {loja.total_avaliacoes != null && loja.total_avaliacoes > 0 && (
                    <span style={{ color: "#9CA3AF", fontSize: 11 }}>({loja.total_avaliacoes})</span>
                  )}
                </>
              ) : (
                <span style={{ color: "#9CA3AF", fontSize: 11, marginLeft: 2 }}>Sem avaliações</span>
              )}
            </div>
            {loja.descricao && (
              <p style={{ color: "#6B7280", fontSize: 12, marginBottom: 5, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{loja.descricao}</p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
              <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 6, background: loja.aberto ? "rgba(34,197,94,0.12)" : "rgba(0,0,0,0.06)", color: loja.aberto ? "#16a34a" : "#9ca3af" }}>
                {loja.aberto ? "● Aberto" : "Fechado"}
              </span>
              <span style={{ color: "#9CA3AF", fontSize: 11 }}>·</span>
              <span style={{ fontSize: 11, color: "#9CA3AF" }}>{loja.tempo_min}–{loja.tempo_max} min</span>
              {distLabel && (<>
                <span style={{ color: "#9CA3AF", fontSize: 11 }}>·</span>
                <span style={{ fontSize: 11, color: "#6B7280", display: "flex", alignItems: "center", gap: 3 }}>
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  {distLabel}
                </span>
              </>)}
              {loja.taxa_entrega === 0 ? (
                <span style={{ fontSize: 11, fontWeight: 800, color: "#7C3AED", background: "rgba(124,58,237,0.1)", padding: "2px 7px", borderRadius: 6 }}>Grátis</span>
              ) : (
                <span style={{ fontSize: 11, color: "#9CA3AF" }}>R$ {loja.taxa_entrega.toFixed(2)}</span>
              )}
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D1D5DB" strokeWidth="2.5" strokeLinecap="round"><polyline points="9 18 15 12 9 6"/></svg>
        </div>
      </Link>
    )
  }

  return (
    <Link href={`/restaurante/${loja.id}`} style={{ textDecoration: "none" }}>
      <div
        style={{
          background: "white", borderRadius: 16, overflow: "hidden", cursor: "pointer",
          boxShadow: "0 4px 20px rgba(0,0,0,0.09)",
          transition: "transform 0.18s, box-shadow 0.18s",
          opacity: loja.aberto ? 1 : 0.65,
        }}
        onMouseEnter={e => {
          if (loja.aberto) {
            e.currentTarget.style.transform = "translateY(-5px)"
            e.currentTarget.style.boxShadow = "0 12px 36px rgba(0,0,0,0.15)"
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.transform = ""
          e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.09)"
        }}>
        {loja.logo_url ? (
          <div style={{ height: 160, position: "relative", overflow: "hidden" }}>
            <img src={loja.logo_url} alt={loja.nome} style={{ width: "100%", height: "100%", objectFit: "contain", background: "white" }} />
            <span style={{ position: "absolute", top: 10, right: 10, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: loja.aberto ? "#22C55E" : "rgba(0,0,0,0.5)", color: "white" }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        ) : (
          <div style={{ height: 160, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 56, position: "relative", background: loja.aberto ? `linear-gradient(135deg, ${c.accent}, ${c.accent}cc)` : "linear-gradient(135deg, #d1d5db, #9ca3af)" }}>
            {CAT_ICONS_LOCAL[loja.categoria]}
            <span style={{ position: "absolute", top: 10, right: 10, fontSize: 12, fontWeight: 700, padding: "4px 12px", borderRadius: 20, background: loja.aberto ? "#22C55E" : "rgba(0,0,0,0.3)", color: "white" }}>
              {loja.aberto ? "● Aberto" : "Fechado"}
            </span>
          </div>
        )}
        <div style={{ padding: "14px 16px 18px" }}>
          <p style={{ color: "#1a1a1a", fontWeight: 700, fontSize: 16, lineHeight: 1.2, marginBottom: 4 }}>{loja.nome}</p>
          <div style={{ display: "flex", alignItems: "center", gap: 3, marginBottom: 8 }}>
            {[1,2,3,4,5].map(s => {
              const nota = Number(loja.nota_media ?? 0)
              const filled = nota > 0 && nota >= s
              const half   = nota > 0 && !filled && nota >= s - 0.5
              return (
                <svg key={s} width="13" height="13" viewBox="0 0 24 24" fill={filled ? "#f59e0b" : half ? "url(#dhstar)" : "#E5E7EB"} stroke="none">
                  <defs><linearGradient id="dhstar"><stop offset="50%" stopColor="#f59e0b"/><stop offset="50%" stopColor="#E5E7EB"/></linearGradient></defs>
                  <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
              )
            })}
            {loja.nota_media != null && loja.nota_media > 0 ? (
              <>
                <span style={{ color: "#111827", fontWeight: 700, fontSize: 13, marginLeft: 2 }}>{Number(loja.nota_media).toFixed(1)}</span>
                {loja.total_avaliacoes != null && loja.total_avaliacoes > 0 && (
                  <span style={{ color: "#9CA3AF", fontSize: 12 }}>({loja.total_avaliacoes})</span>
                )}
              </>
            ) : (
              <span style={{ color: "#9CA3AF", fontSize: 12, marginLeft: 2 }}>Sem avaliações</span>
            )}
          </div>
          {loja.descricao && (
            <p style={{ color: "#6B7280", fontSize: 13, marginBottom: 10, lineHeight: 1.4, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
              {loja.descricao}
            </p>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, flexWrap: "wrap" }}>
            <span style={{ color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              {loja.tempo_min}–{loja.tempo_max} min
            </span>
            {distLabel && (<>
              <span style={{ color: "#e5e7eb" }}>·</span>
              <span style={{ color: "#6B7280", display: "flex", alignItems: "center", gap: 4 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                {distLabel}
              </span>
            </>)}
            <span style={{ color: "#e5e7eb" }}>·</span>
            <span style={{ color: loja.taxa_entrega === 0 ? "#16a34a" : "#6B7280", fontWeight: loja.taxa_entrega === 0 ? 700 : 400, display: "flex", alignItems: "center", gap: 4 }}>
              {loja.taxa_entrega === 0 ? (
                <><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>Grátis</>
              ) : `R$ ${loja.taxa_entrega.toFixed(2)}`}
            </span>
            <span style={{ marginLeft: "auto", fontSize: 12, fontWeight: 600, padding: "4px 10px", borderRadius: 8, background: c.bg, color: c.text }}>
              {loja.categoria}
            </span>
          </div>
        </div>
      </div>
    </Link>
  )
}
