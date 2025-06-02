# StepStyle: E-Commerce Shoe Store

## 🌐 Installation & Setup

1. Install dependencies:
   ```bash
   npm install
   ```
2. Run the development server:
   ```bash
   npm run dev
   ```
3. Build for production:
   ```bash
   npm run build
   ```
   
## 📁 Project Structure

```
shoe-store/
├── public/                                # Static assets
│   └── images/                            # Product images, logos, and UI assets
├── src/
│   ├── app/                               # Next.js App Router pages
│   │   ├── page.tsx                       # Home page
│   │   ├── about/                         # About page
│   │   ├── account/                       # User account management
│   │   ├── auth/                          # Authentication flows
│   │   ├── cart/                          # Shopping cart
│   │   ├── contact/                       # Contact page
│   │   ├── products/                      # Product listings
│   │   └── wishlist/                      # User wishlist
│   ├── components/                        # Reusable React components
│   │   ├── AddToCartButton.tsx
│   │   ├── AddToWishlistButton.tsx
│   │   ├── CartItems.tsx
│   │   ├── Footer.tsx
│   │   ├── ImageCarousel.tsx
│   │   ├── Navbar.tsx
│   │   └── ... other components
│   └── lib/                               # Utilities and data layer
└── configuration files
    ├── next.config.js
    ├── tailwind.config.js
    ├── postcss.config.js
    └── package.json
```

## 🔧 Technologies & Stack

### Primary Stack
- Next.js 14 - 45%: Front-end framework, App Router, SSR
- TailwindCSS - 30%: Styling, Responsive design, UI components
- TypeScript - 15%: Type-safe development
- React Hooks - 10%: State management, Local storage

### Development Tools
- PostCSS
- Node.js
- npm
- Vercel (deployment)

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
