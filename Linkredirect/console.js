(() => {
  const ORIGIN = "http://127.0.0.1:3030";
  const bodies = Array.from(document.querySelectorAll(".a3s")).filter(
    (el) => el.offsetParent !== null
  );
  let anchors = bodies.flatMap((el) => Array.from(el.querySelectorAll("a")));
  if (!anchors.length) anchors = Array.from(document.querySelectorAll("a"));
  const urls = anchors
    .map(
      (a) =>
        a.getAttribute("data-saferedirecturl") || a.getAttribute("href") || ""
    )
    .map((u) => u.trim())
    .filter((u) => /^https?:/i.test(u) && !u.startsWith("mailto:"));
  if (!urls.length) {
    console.warn("No links found.");
    return;
  }
  const form = document.createElement("form");
  form.method = "POST";
  form.action = ORIGIN + "/view";
  form.target = "_blank";
  const ta = document.createElement("textarea");
  ta.name = "urls";
  ta.value = urls.join("\n");
  form.appendChild(ta);
  document.body.appendChild(form);
  form.submit();
  form.remove();
})();
