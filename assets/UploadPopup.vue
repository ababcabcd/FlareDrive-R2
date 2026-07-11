<script setup>
defineProps({
  modelValue: Boolean,
});

const emit = defineEmits(["update:modelValue", "upload", "createFolder"]);
</script>
<template>
  <div class="popup">
    <Transition name="fade">
      <div
        v-if="modelValue"
        class="popup-modal"
        @click="emit('update:modelValue', false)"
      ></div>
    </Transition>
    <Transition name="slide-down">
      <div v-if="modelValue" class="popup-content">
        <div class="button-grid">
          <button onclick="this.lastElementChild.click()">
            <svg t="1741765138405" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg" p-id="31621" width="25" height="25"><path d="M834.303 352.752L624.215 142.571c-5.588-5.208-12.83-8.648-20.833-8.648H259.056c-21.565 0-40.904 9.022-54.85 23.243-14.498 14.036-23.056 33.466-23.056 54.664v600.251c0 21.287 8.558 41.085 23.056 55.305 13.945 14.046 33.472 22.691 54.85 22.691h505.716c20.813 0 40.343-8.646 54.475-22.501l0.735-0.19v-0.176c14.132-14.506 22.868-33.842 22.868-55.129v-438.32c0-7.62-2.967-14.87-8.547-21.009z m-213.446-130.98l134.247 134.241H652.102c-8.557 0-16.363-3.538-21.758-9.301l-0.75-0.74c-5.379-5.396-8.736-13.204-8.736-21.29v-102.91z m163.8 590.309c0 5.39-2.04 10.318-5.757 14.037-3.728 3.902-8.555 5.761-14.129 5.761H259.056c-5.395 0-10.229-1.858-13.944-5.761-3.53-3.719-5.763-8.647-5.763-14.037V211.83c0-5.12 2.232-10.139 5.763-13.766 3.716-3.716 8.55-6.037 13.944-6.037h326.659v132.655c0 17.573 7.254 33.375 18.599 45.549l1.302 1.307c11.72 12.175 28.447 19.33 46.486 19.33h132.556v421.213z" fill="" p-id="31622"></path><path d="M456.736 551.179H306.729c-9.397 0-17.046 7.87-17.046 17.164v150.111c0 9.289 7.648 16.723 17.046 16.723h150.008c9.396 0 17.156-7.434 17.156-16.723V568.343c0-9.294-7.76-17.164-17.157-17.164z m-17.064 150.108H323.896V585.399h115.776v115.888zM456.736 290.763H306.729c-9.397 0-17.046 7.648-17.046 17.269V457.816c0 9.512 7.648 16.945 17.046 16.945h150.008c9.396 0 17.156-7.434 17.156-16.945V308.031c0-9.62-7.76-17.268-17.157-17.268z m-17.064 149.886H323.896V324.762h115.776v115.887zM506.365 434.089c0 9.401 7.546 17.274 17.057 17.274h193.727c9.398 0 17.167-7.873 17.167-17.274 0-9.402-7.769-17.055-17.167-17.055H523.422a17.01 17.01 0 0 0-17.057 17.055zM717.148 575.016H523.422c-9.511 0-17.057 7.541-17.057 16.943 0 9.296 7.546 17.272 17.057 17.272h193.727c9.398 0 17.167-7.977 17.167-17.272-0.001-9.402-7.769-16.943-17.168-16.943zM717.148 677.453H523.422a17.01 17.01 0 0 0-17.057 17.054c0 9.623 7.546 17.165 17.057 17.165h193.727c9.398 0 17.167-7.542 17.167-17.165-0.001-9.4-7.769-17.054-17.168-17.054z" fill="" p-id="31623"></path></svg>
            <span>上传文件</span>
            <input
              id="file-upload"
              name="file-upload"
              type="file"
              accept="*"
              multiple
              hidden
              @change="emit('upload', $event.target)"
            />
          </button>


          <button @click="emit('createFolder')">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="25" height="25"><path d="M703.8 547.8h-167v-167c0-13.8-11.2-25-25-25s-25 11.2-25 25v167h-167c-13.8 0-25 11.2-25 25s11.2 25 25 25h167v167c0 13.8 11.2 25 25 25s25-11.2 25-25v-167h167c13.8 0 25-11.2 25-25s-11.2-25-25-25z" fill="#2c2c2c"/><path d="M833.3 234.1H530.8l-29.6-58.5c-10.4-20.6-26.4-37.9-46.1-50.1-19.7-12.1-42.3-18.5-65.5-18.5H188.7c-68.9 0-125 56.1-125 125v513.5c0 96.5 78.5 175 175 175h544.7c96.5 0 175-78.5 175-175V359.1c-0.1-68.9-56.1-125-125.1-125z m75 511.5c0 68.9-56.1 125-125 125H238.7c-68.9 0-125-56.1-125-125V232c0-41.4 33.6-75 75-75h200.9c28.4 0 54.1 15.8 66.9 41.1l36.6 72.2c4.3 8.4 12.9 13.7 22.3 13.7h317.9c41.4 0 75 33.6 75 75v386.6z" fill="#2c2c2c"/></svg>
            <span>新建文件夹</span>
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>

<style>
.popup-modal {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  z-index: 3;
  background-color: rgba(0, 0, 0, 0.2);
}

.popup-content {
    position: fixed;
    right: 30px;
    top: 55px;
    width: 200px;
    z-index: 4;
    border-radius: 12px;
    background-color: white;
}

.popup .button-grid {
  display: grid;
  grid-template-columns: repeat(1, 1fr);
  grid-gap: 8px;
  padding: 8px;
}

.popup button {
  border-radius: 8px;
  display: flex;
  flex-direction: row;
  align-items: center;
  text-align: center;
  font-size: 17px;
  transition: background-color 0.3s;
}

.popup button:hover {
  background-color: #f5f5f5;
}

.popup svg {
  width: 25px;
  height: 25px;
  margin: 8px 12px 8px 8px;
}
</style>
