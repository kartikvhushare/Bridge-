/* mirrors the inline tailwind.config in index.html exactly */
module.exports = {
  content: ['./work/mobile-audit/pages/*.html'],
  theme: { extend: {
    fontFamily: { display: ['"Schibsted Grotesk"'], sans: ['"Hanken Grotesk"'] },
    colors: {
      ink: { DEFAULT:'#15171C',50:'#F6F7F8',100:'#ECEDF0',200:'#D6D8DE',300:'#A9ADB8',400:'#6B7280',500:'#3A3E48',600:'#262A33',700:'#1C1F26',800:'#15171C' },
      brand: { DEFAULT:'#0E9F6E',50:'#ECFDF5',100:'#D1FAE5',400:'#34D399',500:'#10B981',600:'#0E9F6E',700:'#0B7A55' },
      paper: '#F7F6F2',
    },
    boxShadow: { soft:'0 1px 2px rgba(16,24,40,.04),0 4px 16px -6px rgba(16,24,40,.10)', pop:'0 8px 40px -8px rgba(16,24,40,.28)' },
  } },
};
