export default function BrandLogo({ className = "w-10 h-10" }) {
  return (
    <img
      src="/logo.png"
      alt="Цифровой волонтёр Обнинска"
      width="48"
      height="48"
      className={`brand-logo rounded-xl object-contain shrink-0 ${className}`}
    />
  );
}
