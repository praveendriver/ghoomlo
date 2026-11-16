import Script from "next/script";

/**
 * Microsoft Clarity session recording. Loads only when CLARITY_PROJECT_ID is
 * set, so local development and tests are never recorded. The footer tells
 * visitors that usage is recorded.
 */
export function Clarity() {
  const id = process.env.CLARITY_PROJECT_ID;
  if (!id || !/^[a-z0-9]{6,20}$/i.test(id)) return null;
  return (
    <Script id="clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");`}
    </Script>
  );
}

export function isRecordingUsage(): boolean {
  return Boolean(process.env.CLARITY_PROJECT_ID);
}
