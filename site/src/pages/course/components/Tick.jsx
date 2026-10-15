// A tick in the same 26×27 box and weight as the original Arrow, for checked rows.
function Tick({ className }) {
  return (
    <svg className={className} viewBox="0 0 26 27" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="M9.9 21.6L0.6 12.3L2.9 10L9.9 17L23.1 3.8L25.4 6.1L9.9 21.6Z" />
    </svg>
  );
}

export default Tick;
