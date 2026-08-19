export class Ui {
  constructor() {
    this.toastEl = document.getElementById("ui-toast");
    this.modal = document.getElementById("ui-modal");
    this.modalTitle = document.getElementById("ui-modal-title");
    this.modalBody = document.getElementById("ui-modal-body");
    this.modalInput = document.getElementById("ui-modal-input");
    this.modalOk = document.getElementById("ui-modal-ok");
    this.modalCancel = document.getElementById("ui-modal-cancel");
    this.toastTimer = 0;
    this.modalDone = null;
  }

  bind() {
    const self = this;
    this.modalOk.addEventListener("click", function () {
      self.finishModal(self.modalInput.hidden ? true : self.modalInput.value);
    });
    this.modalCancel.addEventListener("click", function () {
      self.finishModal(self.modalInput.hidden ? false : null);
    });
    this.modal.addEventListener("click", function (e) {
      if (e.target.classList.contains("ui-mask")) {
        self.finishModal(self.modalInput.hidden ? false : null);
      }
    });
    this.modalInput.addEventListener("keydown", function (e) {
      if (e.key !== "Enter") return;
      e.preventDefault();
      self.finishModal(self.modalInput.value);
    });
  }

  toast(text) {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    clearTimeout(this.toastTimer);
    const self = this;
    this.toastTimer = setTimeout(function () {
      self.toastEl.hidden = true;
    }, 2200);
  }

  finishModal(value) {
    if (!this.modalDone) return;
    const done = this.modalDone;
    this.modalDone = null;
    this.modal.hidden = true;
    done(value);
  }

  openModal(opts) {
    const self = this;
    return new Promise(function (resolve) {
      if (self.modalDone) self.finishModal(self.modalInput.hidden ? false : null);
      self.modalDone = resolve;
      self.modalTitle.textContent = opts.title || "";
      if (opts.body) {
        self.modalBody.textContent = opts.body;
        self.modalBody.hidden = false;
      } else {
        self.modalBody.textContent = "";
        self.modalBody.hidden = true;
      }
      if (opts.input) {
        self.modalInput.hidden = false;
        self.modalInput.value = opts.value || "";
        setTimeout(function () {
          self.modalInput.focus();
          self.modalInput.select();
        }, 0);
      } else {
        self.modalInput.hidden = true;
        self.modalInput.value = "";
      }
      self.modal.hidden = false;
    });
  }
}

export function loadJson(url) {
  return fetch(url).then(function (r) {
    if (!r.ok) throw new Error(url);
    return r.json();
  });
}
