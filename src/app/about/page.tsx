import Image from 'next/image';
import { Metadata } from 'next';
import Link from 'next/link';
import { getProducts, getCategories } from '@/lib/data';
import ClientImage from '@/components/ClientImage';
import TeamMemberImage from '@/components/TeamMemberImage';

export const metadata: Metadata = {
  title: 'About Us | StepStyle',
  description: 'Learn about StepStyle - Your premier destination for quality footwear',
};

export default async function AboutPage() {
  // Get product categories to showcase the variety
  const categories = await getCategories();
  // Get total product count
  const products = await getProducts();
  const productCount = products.length;
  
  // Get some product images to use as fallbacks if needed
  const productImages = products.slice(0, 3).map(p => `${p.imagePath}/HomeProduct.webp`);

  return (
    <div className="container mx-auto px-4 py-8 pt-24">
      <h1 className="mb-8 text-4xl font-bold text-center">About StepStyle</h1>
      
      {/* Hero Section */}
      <div className="relative h-[500px] w-full mb-12 overflow-hidden rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600">
        <ClientImage
          src="/images/Slide-3.png"
          alt="StepStyle Store"
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-black bg-opacity-20 flex flex-col items-center justify-center text-white p-8">
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Delivering quality footwear for every step of life&apos;s journey</p>
        </div>
      </div>
      
      {/* Our Story */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">Our Story</h2>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <p className="text-lg mb-4">
              Founded in 2025, StepStyle emerged from a simple idea: everyone deserves quality footwear that doesn&apos;t compromise on style or comfort.
            </p>
            <p className="text-lg mb-4">
              What started as a small boutique has grown into a trusted footwear destination, offering a carefully curated selection of shoes for every occasion, from casual outings to formal events, athletic pursuits to outdoor adventures.
            </p>
            <p className="text-lg">
              Today, we proudly serve thousands of customers with our collection of premium footwear from established brands and emerging designers, all united by our commitment to quality, comfort, and style.
            </p>
          </div>
          <div className="relative h-80 overflow-hidden rounded-lg bg-gray-100">
            <ClientImage
              src="/images/our-story.jpg"
              alt="Our Story"
              fill
              className="object-cover"
              fallbackSrc={productImages[0]}
            />
          </div>
        </div>
      </section>
      
      {/* Our Mission */}
      <section className="mb-16 bg-gray-50 p-8 rounded-xl">
        <h2 className="text-3xl font-bold mb-6 text-center">Our Mission</h2>
        <div className="max-w-3xl mx-auto">
          <p className="text-xl text-center mb-8">
            To provide exceptional footwear that enhances everyday experiences through the perfect balance of comfort, durability, and style.
          </p>
          <div className="grid md:grid-cols-3 gap-6 text-center">
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-indigo-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Comfort</h3>
              <p>We believe comfortable shoes are essential for a good quality of life.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-indigo-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.989 5.989 0 01-2.031.352 5.989 5.989 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Quality</h3>
              <p>Our shoes are crafted to last, using premium materials and skilled craftsmanship.</p>
            </div>
            <div className="p-6 bg-white rounded-lg shadow-sm">
              <div className="w-16 h-16 mx-auto mb-4 flex items-center justify-center bg-indigo-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8 text-indigo-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-2">Style</h3>
              <p>We carefully select shoes that help you express your personal style with confidence.</p>
            </div>
          </div>
        </div>
      </section>
      
      {/* Product Showcase */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">Our Collection</h2>
        <div className="bg-white p-6 rounded-lg border border-gray-200">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <span className="text-3xl font-bold text-indigo-600">{productCount}</span>
              <p className="text-gray-700">Products</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <span className="text-3xl font-bold text-indigo-600">{categories.length}</span>
              <p className="text-gray-700">Categories</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <span className="text-3xl font-bold text-indigo-600">10+</span>
              <p className="text-gray-700">Brands</p>
            </div>
            <div className="text-center p-4 bg-indigo-50 rounded-lg">
              <span className="text-3xl font-bold text-indigo-600">1000+</span>
              <p className="text-gray-700">Happy Customers</p>
            </div>
          </div>
          
          <h3 className="text-xl font-semibold mb-4">Categories We Offer</h3>
          <div className="flex flex-wrap gap-2 mb-6">
            {categories.map((category) => (
              <Link href={`/products?category=${category}`} key={category}>
                <span className="inline-block rounded-full bg-gray-100 px-4 py-2 text-sm font-medium text-gray-800 hover:bg-gray-200 transition-colors">
                  {category}
                </span>
              </Link>
            ))}
          </div>
          
          <div className="text-center mt-8">
            <Link href="/products" className="inline-block rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90">
              Browse All Products
            </Link>
          </div>
        </div>
      </section>
      
      {/* Team Section */}
      <section className="mb-16">
        <h2 className="text-3xl font-bold mb-6 text-center">Our Team</h2>
        <div className="grid md:grid-cols-3 gap-8">
          {/* Team Member 1 */}
          <div className="text-center">
            {productImages.length > 0 && (
              <TeamMemberImage
                src="/images/Laxmi.png"
                alt="Team Member"
                productFallback={productImages[0]}
              />
            )}
            <h3 className="text-xl font-semibold">Laxmi Jaiswar</h3>
            <p className="text-indigo-600 mb-2">Founder & CEO</p>
            <p className="text-gray-600">Passionate about bringing quality footwear to everyone</p>
          </div>
          
          {/* Team Member 2 */}
          <div className="text-center">
            {productImages.length > 1 && (
              <TeamMemberImage
                src="/images/Samir.png"
                alt="Team Member"
                productFallback={productImages[1]}
              />
            )}
            <h3 className="text-xl font-semibold">Samir Shaikh</h3>
            <p className="text-indigo-600 mb-2">Head of Design</p>
            <p className="text-gray-600">Curates our collection with an eye for style and comfort</p>
          </div>
          
          {/* Team Member 3 */}
          <div className="text-center">
            {productImages.length > 2 && (
              <TeamMemberImage
                src="/images/Malik.png"
                alt="Team Member"
                productFallback={productImages[0]}
              />
            )}
            <h3 className="text-xl font-semibold">Malik Shaikh</h3>
            <p className="text-indigo-600 mb-2">Customer Experience</p>
            <p className="text-gray-600">Ensures every customer finds their perfect pair</p>
          </div>
        </div>
      </section>
      
      {/* Contact Section */}
      <section className="mb-8 bg-gray-50 p-8 rounded-xl">
        <h2 className="text-3xl font-bold mb-6 text-center">Get In Touch</h2>
        <div className="max-w-lg mx-auto">
          <p className="text-center mb-8">
            Have questions about our products or services? We&apos;d love to hear from you.
          </p>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 mb-4 flex items-center justify-center bg-indigo-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Email Us</h3>
              <p className="text-center">soyxbshxikh@gmail.com</p>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-12 h-12 mb-4 flex items-center justify-center bg-indigo-100 rounded-full">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6 text-indigo-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold mb-2">Call Us</h3>
              <p className="text-center">+91 8767402383</p>
            </div>
          </div>
          <div className="text-center mt-8">
            <button className="inline-block rounded-full bg-indigo-600 px-6 py-3 text-base font-medium text-white transition-opacity hover:opacity-90">
              Contact Us
            </button>
          </div>
        </div>
      </section>
    </div>
  );
} 