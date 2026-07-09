import './globals.css';

export const metadata = {
  title: 'FootyPartner',
  description: 'Live World Cup match companion powered by TxLINE.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
