document.addEventListener("click", async (event) => {

    var htmlElement = event.target as HTMLElement
    var element = document.createElement('div');
    element.innerHTML = htmlElement.outerHTML;

    var link = element.querySelector('a');
    if (link) {
        var attribute = link.getAttribute('epub:type') == 'noteref';
        if (attribute) {
            event.preventDefault()
            event.stopPropagation()

            var href = link.getAttribute("href")
            if (href.indexOf("#") > 0) {
                var id = href.substring(href.indexOf('#') + 1)
                var absolute = getAbsoluteHref(href)
                absolute = absolute.substring(0, absolute.indexOf("#"))

                await fetch(absolute)
                    .then(r => r.text())
                    .then(async data => {
                        var parser = new DOMParser();
                        var doc = parser.parseFromString(data, "text/html");
                        var aside = doc.querySelector("aside#" + id)
                        if (aside) {
                            var modal = document.createElement('div');
                            modal.className = 'modal';
                            modal.innerHTML = '<div class="modal-content"><span class="close">x</span>' + aside.innerHTML + '</div>'
                            modal.style.display = "block";

                            document.body.appendChild(modal)

                            var modalContent = modal.getElementsByClassName("modal-content")[0] as HTMLDivElement
                            var offset = htmlElement.offsetTop
                            if (htmlElement.offsetTop > 100) {
                                offset = htmlElement.offsetTop - 20
                            }
                            modalContent.style.top = offset + "px";

                            var span = modal.getElementsByClassName("close")[0] as HTMLSpanElement
                            span.onclick = function () {
                                modal.style.display = "none";
                                modal.parentElement.removeChild(modal)
                            }
                            
                            window.onclick = function (event) {
                                if (event.target == modal) {
                                    modal.style.display = "none";
                                    modal.parentElement.removeChild(modal)
                                }
                            }
                        }
                    })
            }
        }
    }

    function getAbsoluteHref(href: string): string | null {
        var currentUrl = document.location.href;
        return new URL(href, currentUrl).href;
    }

}, true);
