<template>
  <!-- 自定义登录表单 -->
  <div v-if="showLogin" class="login-overlay">
    <div class="login-card">
      <div class="login-header">
        <img src="/assets/homescreen.webp" alt="PAN" style="height: 48px" />
        <h2>PAN 网盘</h2>
      </div>
      <form class="login-form" @submit.prevent="doLogin">
        <div class="login-field">
          <label>用户名</label>
          <input
            type="text"
            v-model="loginUsername"
            placeholder="请输入用户名"
            autocomplete="username"
            :disabled="loginLoading"
          />
        </div>
        <div class="login-field">
          <label>密码</label>
          <input
            type="password"
            v-model="loginPassword"
            placeholder="请输入密码"
            autocomplete="current-password"
            :disabled="loginLoading"
            @keyup.enter="doLogin"
          />
        </div>
        <div v-if="loginError" class="login-error">{{ loginError }}</div>
        <button type="submit" class="login-btn" :disabled="loginLoading">
          {{ loginLoading ? '登录中...' : '登录' }}
        </button>
      </form>
    </div>
  </div>

  <div v-show="!showLogin" class="main" 
      @dragenter.prevent 
      @dragover.prevent 
      @drop.prevent="onDrop"
      :style="{ backgroundImage: `url('${backgroundImageUrl}')` }"
  >
    <progress v-if="uploadProgress !== null" :value="uploadProgress" max="100"></progress>
    <UploadPopup v-model="showUploadPopup" @upload="onUploadClicked" @createFolder="createFolder"></UploadPopup>
    <button class="upload-button circle" @click="showUploadPopup = true">
      <svg t="1741764069699" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
        p-id="24280" width="24" height="24">
        <path
          d="M576 557.7088V934.4H448V560.4416l-43.8912 43.8848L313.6 513.8176l199.1232-199.1168 0.64 0.64 0.64-0.64 199.1232 199.1168-90.5088 90.5088L576 557.7088zM704 678.4h32c88.3648 0 160-71.6352 160-160s-71.6352-160-160-160c-20.5184 0-40.128 3.8592-58.1568 10.8992C670.336 270.1248 587.4944 192 486.4 192c-106.0416 0-192 85.9584-192 192 0 15.9104 1.9328 31.3728 5.5872 46.1568A127.7504 127.7504 0 0 0 256 422.4c-70.6944 0-128 57.3056-128 128s57.3056 128 128 128h64v128H256c-141.3824 0-256-114.6176-256-256 0-113.3184 73.632-209.4464 175.6608-243.136C210.0352 167.584 336.1216 64 486.4 64c121.312 0 227.552 67.712 281.7728 168.1792C912.0896 248.1792 1024 370.2208 1024 518.4c0 159.0592-128.9408 288-288 288h-32v-128z"
          fill="#e6e6e6" p-id="24281"></path>
      </svg>
    </button>
    <div class="app-bar">
      <a class="app-title-container" style="display: flex; align-items: center;" href="/">
        <img src="/assets/homescreen.webp" alt="PAN" style="height: 24px" />
        <h1 class="app-title" style="font-size: 20px;margin: 0 25px 0 8px; user-select: none;">PAN</h1>
      </a>

      <input 
        type="search" 
        v-model="search" 
        aria-label="Search" 
        placeholder="🍿 输入以全局搜索文件" 
        @input="handleSearch"
        @keyup.enter="handleSearch"
      />
      <div class="menu-button">
        <button class="circle" @click="showMenu = true" style="display: flex; align-items: center;background-color: rgb(245, 245, 245);">
          <svg t="1741761597964" class="icon" viewBox="0 0 1024 1024" version="1.1" xmlns="http://www.w3.org/2000/svg"
            p-id="22027" width="24" height="24">
            <path
              d="M365 663.5v210.7c0 18.6-23.4 26.8-35 12.3L131.2 637.9c-13.3-16.6-1.5-41.1 19.8-41.1h80.7v-400c0-36.8 29.8-66.7 66.7-66.7 36.8 0 66.7 29.8 66.7 66.7v466.7h-0.1z m200-466.7h266.7c36.8 0 66.7 29.8 66.7 66.7s-29.8 66.7-66.7 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0-36.8 29.9-66.7 66.7-66.7z m0 266.7h200c36.8 0 66.7 29.8 66.7 66.6s-29.8 66.7-66.6 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0.1-36.8 29.9-66.6 66.7-66.6z m0 266.7h133.3c36.8 0 66.7 29.8 66.7 66.7 0 36.8-29.8 66.7-66.7 66.7H565c-36.8 0-66.7-29.8-66.7-66.7 0.1-36.9 29.9-66.7 66.7-66.7z"
              p-id="22028" fill="#2c2c2c"></path>
          </svg>
        </button>
        <Menu v-model="showMenu"
          :items="[{ text: '按照名称排序A-Z' }, { text: '按照大小递增排序' }, { text: '按照大小递减排序' }, { text: '退出登录' }]"
          @click="onMenuClick" />
      </div>
    </div>
    <div class="file-list-container">
      <div class="toolbar">
        <div ref="toolbarPathRef" class="toolbar-path">
          <button class="path-link" @click="cwd = ''">
            <svg viewBox="0 0 576 512" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <path d="M575.8 255.5c0 18-15 32.1-32 32.1l-32 0 .7 160.2c0 2.7-.2 5.4-.5 8.1l0 16.2c0 22.1-17.9 40-40 40l-16 0c-1.1 0-2.2 0-3.3-.1c-1.4 .1-2.8 .1-4.2 .1L416 512l-24 0c-22.1 0-40-17.9-40-40l0-24 0-64c0-17.7-14.3-32-32-32l-64 0c-17.7 0-32 14.3-32 32l0 64 0 24c0 22.1-17.9 40-40 40l-24 0-31.9 0c-1.5 0-3-.1-4.5-.2c-1.2 .1-2.4 .2-3.6 .2l-16 0c-22.1 0-40-17.9-40-40l0-112c0-.9 0-1.9 .1-2.8l0-69.7-32 0c-18 0-32-14-32-32.1c0-9 3-17 10-24L266.4 8c7-7 15-8 22-8s15 2 21 7L564.8 231.5c8 7 12 15 11 24z"/>
            </svg>
          </button>
          <span ref="pathWidthRef" class="path-width-measure" v-show="cwd">
            <span class="path-separator">/</span>
            <template v-for="(segment, index) in cwdSegments" :key="index">
              <span>{{ segment.name }}</span>
              <span class="path-separator">/</span>
            </template>
          </span>
          <template v-if="cwd">
            <span class="path-separator">/</span>
            <template v-for="(segment, index) in visiblePathSegments" :key="index">
              <template v-if="segment.isEllipsis">
                <span class="path-ellipsis">…</span>
              </template>
              <template v-else-if="segment.isCurrent">
                <span class="path-current">{{ segment.name }}</span>
              </template>
              <template v-else>
                <button class="path-link" @click="navigateToPath(segment.path)">
                  {{ segment.name }}
                </button>
              </template>
              <span class="path-separator" v-if="index < visiblePathSegments.length - 1 && !segment.isEllipsis">/</span>
            </template>
          </template>
        </div>
        <div class="toolbar-actions">
          <button class="toolbar-icon-btn" @click="createFolder()" title="新建文件夹">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <path d="M703.8 547.8h-167v-167c0-13.8-11.2-25-25-25s-25 11.2-25 25v167h-167c-13.8 0-25 11.2-25 25s11.2 25 25 25h167v167c0 13.8 11.2 25 25 25s25-11.2 25-25v-167h167c13.8 0 25-11.2 25-25s-11.2-25-25-25z" fill="currentColor"/>
              <path d="M833.3 234.1H530.8l-29.6-58.5c-10.4-20.6-26.4-37.9-46.1-50.1-19.7-12.1-42.3-18.5-65.5-18.5H188.7c-68.9 0-125 56.1-125 125v513.5c0 96.5 78.5 175 175 175h544.7c96.5 0 175-78.5 175-175V359.1c-0.1-68.9-56.1-125-125.1-125z m75 511.5c0 68.9-56.1 125-125 125H238.7c-68.9 0-125-56.1-125-125V232c0-41.4 33.6-75 75-75h200.9c28.4 0 54.1 15.8 66.9 41.1l36.6 72.2c4.3 8.4 12.9 13.7 22.3 13.7h317.9c41.4 0 75 33.6 75 75v386.6z" fill="currentColor"/>
            </svg>
          </button>
          <button class="toolbar-icon-btn" @click="openShareManagement()" title="管理分享链接">
            <svg viewBox="0 0 1024 1024" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
              <path d="M576.8 728c-32.8 0-55.2 22.4-55.2 54.4 0 32.8 22.4 54.4 55.2 54.4 32.8 0 55.2-22.4 55.2-54.4-0.8-32-22.4-54.4-55.2-54.4zM284 510.4c-32.8 0-55.2 22.4-55.2 54.4 0 32.8 22.4 54.4 55.2 54.4 32.8 0 55.2-22.4 55.2-54.4s-22.4-54.4-55.2-54.4z m492.8-365.6H73.6c-21.6 0-40 8-53.6 23.2C7.2 184 0 204 0 228v711.2c0 22.4 8 42.4 24 59.2 16 16.8 34.4 25.6 54.4 25.6h708c24 0 43.2-8 59.2-24.8s24-34.4 24-53.6V247.2c0-30.4-7.2-55.2-22.4-74.4-13.6-18.4-37.6-28-70.4-28z m-200 756.8c-65.6 0-119.2-48.8-119.2-114.4 0-11.2 1.6-21.6 4.8-32L346.4 669.6c-18.4 12-38.4 14.4-62.4 14.4-65.6 0-119.2-53.6-119.2-118.4 0-65.6 53.6-118.4 119.2-118.4 32.8 0 59.2 8.8 80.8 29.6L463.2 416c-4-12-7.2-20-7.2-33.6C456 316.8 509.6 264 575.2 264s119.2 53.6 119.2 118.4c0 65.6-53.6 118.4-119.2 118.4-30.4 0-56-7.2-76.8-26.4l-100.8 59.2c3.2 10.4 5.6 21.6 5.6 33.6 0 19.2-0.8 32.8-8.8 49.6l100.8 77.6c21.6-21.6 49.6-31.2 82.4-31.2 65.6 0 119.2 53.6 119.2 118.4-1.6 66.4-54.4 120-120 120zM992 35.2c-21.6-24-68.8-35.2-104-35.2H304c-19.2 0-36 6.4-50.4 20-13.6 13.6-20.8 29.6-20.8 49.6v11.2h580.8c52 0 76.8 1.6 99.2 21.6 21.6 19.2 24 39.2 24 86.4v678.4h16c19.2 0 36-6.4 50.4-20 13.6-13.6 20.8-29.6 20.8-49.6v-664c0-30.4-11.2-74.4-32-98.4zM575.2 436.8c32.8 0 55.2-22.4 55.2-54.4 0-32.8-22.4-54.4-55.2-54.4-32.8 0-55.2 22.4-55.2 54.4 0 32.8 22.4 54.4 55.2 54.4z" fill="currentColor"/>
            </svg>
          </button>
        </div>
      </div>

      <div v-if="searchResults.length > 0" class="search-results">
        <div class="search-header">
          <span class="search-count">找到 {{ searchResults.length }} 个结果</span>
          <button class="search-close" @click="search = ''; searchResults = []">✕</button>
        </div>
        <ul class="search-list">
          <li 
            v-for="result in searchResults" 
            :key="result.key"
            class="search-item"
            @click="navigateToFile(result.path)"
          >
            <div class="search-icon">
              <svg viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg" width="20" height="20">
                <path d="M476.5 407.6L319.6 226.8c20.9-26.8 32.6-59.9 32.6-95.4C352 69.3 282.7 0 192 0S32 69.3 32 131.4c0 62.1 50.7 112.8 112.8 112.8 35.5 0 68.6-11.7 95.4-32.6l180.8 176.8c4.1 4 10.8 4 14.8 0 4.1-4.1 4.1-10.8 0-14.8zM192 213.4c-44.1 0-80-35.9-80-80s35.9-80 80-80 80 35.9 80 80-35.9 80-80 80z" fill="#1a73e8"/>
              </svg>
            </div>
            <div class="search-info">
              <span class="search-name">{{ result.name }}</span>
              <span class="search-path">/{{ result.path }}</span>
            </div>
            <span class="search-size">{{ this.formatSize(result.size) }}</span>
          </li>
        </ul>
      </div>

      <ul class="file-list" v-if="searchResults.length === 0">
        <li v-if="cwd !== ''">
          <button class="back-link" @click="cwd = cwd.replace(/[^\/]+\/$/, '')">
            返回上级目录
          </button>
        </li>
        <li v-for="folder in filteredFolders" :key="folder">
          <div tabindex="0" class="file-item" @click="cwd = folder" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = folder;
          ">
            <div class="file-icon">
              <svg  viewBox="0 0 576 512"
                xmlns="http://www.w3.org/2000/svg" width="36" height="36">
                <path d="M384 480l48 0c11.4 0 21.9-6 27.6-15.9l112-192c5.8-9.9 5.8-22.1 .1-32.1S555.5 224 544 224l-400 0c-11.4 0-21.9 6-27.6 15.9L48 357.1 48 96c0-8.8 7.2-16 16-16l117.5 0c4.2 0 8.3 1.7 11.3 4.7l26.5 26.5c21 21 49.5 32.8 79.2 32.8L416 144c8.8 0 16 7.2 16 16l0 32 48 0 0-32c0-35.3-28.7-64-64-64L298.5 96c-17 0-33.3-6.7-45.3-18.7L226.7 50.7c-12-12-28.3-18.7-45.3-18.7L64 32C28.7 32 0 60.7 0 96L0 416c0 35.3 28.7 64 64 64l23.7 0L384 480z"/>
              </svg>
            </div>
            <div class="file-info-container"><span class="file-name" v-text="folder.match(/.*?([^/]*)\/?$/)[1]"></span>
            </div>
            <div style="margin-right: 10px;margin-left: auto;" @click.stop="
              showContextMenu = true;
            focusedItem = folder;
            ">
              <svg t="1741761103305" class="icon" viewBox="0 0 1024 1024" version="1.1"
                xmlns="http://www.w3.org/2000/svg" p-id="6484" width="30" height="30">
                <path
                  d="M341.333333 533.333333a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333334z m-469.333334 64H192a64 64 0 0 0-63.893333 60.245334L128 661.333333v149.333334a64 64 0 0 0 60.245333 63.893333L192 874.666667h149.333333a64 64 0 0 0 63.893334-60.245334L405.333333 810.666667v-149.333334a64 64 0 0 0-60.245333-63.893333L341.333333 597.333333z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245334L597.333333 661.333333v149.333334a64 64 0 0 0 60.245334 63.893333L661.333333 874.666667h149.333334a64 64 0 0 0 63.893333-60.245334L874.666667 810.666667v-149.333334a64 64 0 0 0-60.245334-63.893333L810.666667 597.333333zM341.333333 64a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333334zM341.333333 128H192a64 64 0 0 0-63.893333 60.245333L128 192v149.333333a64 64 0 0 0 60.245333 63.893334L192 405.333333h149.333333a64 64 0 0 0 63.893334-60.245333L405.333333 341.333333V192a64 64 0 0 0-60.245333-63.893333L341.333333 128z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245333L597.333333 192v149.333333a64 64 0 0 0 60.245334 63.893334L661.333333 405.333333h149.333334a64 64 0 0 0 63.893333-60.245333L874.666667 341.333333V192a64 64 0 0 0-60.245334-63.893333L810.666667 128z"
                  fill="#2c2c2c" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
        <li v-for="file in filteredFiles" :key="file.key">
          <div @click="preview(`/raw/${file.key}`, file.httpMetadata.contentType)" @contextmenu.prevent="
            showContextMenu = true;
          focusedItem = file;" class="file-item" style="position: relative;">
            <MimeIcon :content-type="file.httpMetadata.contentType" :thumbnail="file.customMetadata.thumbnail
              ? `/raw/_$flaredrive$/thumbnails/${file.customMetadata.thumbnail}.png`
              : null
              " />
            <div class="file-info-container">
              <div class="file-name" v-text="file.key.split('/').pop()"></div>
              <div class="file-attr">
                <span v-text="new Date(file.uploaded).toLocaleString()"></span>
                <span v-text="formatSize(file.size)"></span>
              </div>
            </div>
            <div style="margin-right: 10px;margin-left: auto;" @click.stop="
              showContextMenu = true;
            focusedItem = file;
            ">
              <svg t="1741761103305" class="icon" viewBox="0 0 1024 1024" version="1.1"
                xmlns="http://www.w3.org/2000/svg" p-id="6484" width="30" height="30">
                <path
                  d="M341.333333 533.333333a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333334a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128v-149.333334a128 128 0 0 1 128-128h149.333334z m-469.333334 64H192a64 64 0 0 0-63.893333 60.245334L128 661.333333v149.333334a64 64 0 0 0 60.245333 63.893333L192 874.666667h149.333333a64 64 0 0 0 63.893334-60.245334L405.333333 810.666667v-149.333334a64 64 0 0 0-60.245333-63.893333L341.333333 597.333333z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245334L597.333333 661.333333v149.333334a64 64 0 0 0 60.245334 63.893333L661.333333 874.666667h149.333334a64 64 0 0 0 63.893333-60.245334L874.666667 810.666667v-149.333334a64 64 0 0 0-60.245334-63.893333L810.666667 597.333333zM341.333333 64a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128H192a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333333z m469.333334 0a128 128 0 0 1 128 128v149.333333a128 128 0 0 1-128 128h-149.333334a128 128 0 0 1-128-128V192a128 128 0 0 1 128-128h149.333334zM341.333333 128H192a64 64 0 0 0-63.893333 60.245333L128 192v149.333333a64 64 0 0 0 60.245333 63.893334L192 405.333333h149.333333a64 64 0 0 0 63.893334-60.245333L405.333333 341.333333V192a64 64 0 0 0-60.245333-63.893333L341.333333 128z m469.333334 0h-149.333334a64 64 0 0 0-63.893333 60.245333L597.333333 192v149.333333a64 64 0 0 0 60.245334 63.893334L661.333333 405.333333h149.333334a64 64 0 0 0 63.893333-60.245333L874.666667 341.333333V192a64 64 0 0 0-60.245334-63.893333L810.666667 128z"
                  fill="#2c2c2c" p-id="6485"></path>
              </svg>
            </div>
          </div>
        </li>
      </ul>
    </div>
    <div v-if="loading" style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">加载中...</span>
    </div>
    <div v-else-if="!filteredFiles.length && !filteredFolders.length" style="margin: 20px 0; text-align: center">
      <span style="font-size: 20px;">没有文件</span>
    </div>
    <Dialog v-model="showContextMenu">
      <div
        style="height: 50px;display: flex; justify-content: center; align-items: center; padding:10px; background: #ddd; margin: 0 0 10px 0; border-radius: 8px;">
        <div v-text="focusedItem.key || focusedItem" class="contextmenu-filename" @click.stop.prevent
          style="height:20px;width: 100%; max-width: 100%; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
      </div>
      <ul v-if="typeof focusedItem === 'string'" class="contextmenu-list">
        <li>
          <button @click="copyLink(`/?p=${encodeURIComponent(focusedItem)}`)">
            <span>复制链接</span>
          </button>
        </li>
        <li>
          <button @click="renameFolder(focusedItem)">
            <span>重命名</span>
          </button>
        </li>
        <li>
          <button @click="moveFile(focusedItem + '_$folder$')">
            <span>移动</span>
          </button>
        </li>
        <li>
          <button style="color: red" @click="removeFile(focusedItem + '_$folder$')">
            <span>删除</span>
          </button>
        </li>
      </ul>
      <ul v-else class="contextmenu-list">
        <li>
          <button @click="renameFile(focusedItem.key)">
            <span>重命名</span>
          </button>
        </li>
        <li>
          <a :href="`/raw/${focusedItem.key}`" target="_blank" download>
            <span>下载</span>
          </a>
        </li>
        <li>
          <button @click="clipboard = focusedItem.key">
            <span>复制</span>
          </button>
        </li>
        <li>
          <button @click="moveFile(focusedItem.key)">
            <span>移动</span>
          </button>
        </li>
        <li>
          <button @click="copyLink(`/raw/${focusedItem.key}`)">
            <span>复制链接</span>
          </button>
        </li>
        <li>
          <button @click="openShareModal(focusedItem.key)">
            <span>分享文件</span>
          </button>
        </li>
        <li>
          <button style="color: red" @click="removeFile(focusedItem.key)">
            <span>删除</span>
          </button>
        </li>
      </ul>
    </Dialog>
    <div style="flex:1"></div>
    <div v-if="showShareModal" class="share-modal-overlay" @click="showShareModal = false">
      <div class="share-modal" @click.stop>
        <div class="share-modal-header">
          <h3>分享文件</h3>
          <button class="close-btn" @click="showShareModal = false">×</button>
        </div>
        <div class="share-modal-body">
          <div class="share-option">
            <label>过期时间</label>
            <select v-model="shareExpires" class="share-select">
              <option :value="30">30分钟</option>
              <option :value="60">1小时</option>
              <option :value="24 * 60">1天</option>
              <option :value="7 * 24 * 60">7天</option>
              <option :value="30 * 24 * 60">30天</option>
            </select>
          </div>
          <button class="generate-share-btn" @click="generateShareLink" :disabled="shareGenerating">
            {{ shareGenerating ? '生成中...' : '生成分享链接' }}
          </button>
          <div v-if="shareLink" class="share-link-container">
            <input type="text" :value="shareLink" readonly class="share-link-input" />
            <button class="copy-share-btn" @click="copyShareLink">复制链接</button>
          </div>
          <div v-if="shareError" class="share-error">{{ shareError }}</div>
        </div>
      </div>
    </div>
    <div v-if="showShareManagement" class="share-modal-overlay" @click="showShareManagement = false">
      <div class="share-management-modal" @click.stop>
        <div class="share-modal-header">
          <h3>管理分享链接</h3>
          <button class="close-btn" @click="showShareManagement = false">×</button>
        </div>
        <div class="share-management-body">
          <div v-if="sharesLoading" class="shares-loading">加载中...</div>
          <div v-else-if="shares.length === 0" class="shares-empty">暂无分享链接</div>
          <div v-else class="shares-table-container">
            <table class="shares-table">
              <thead>
                <tr>
                  <th>文件名</th>
                  <th>分享链接</th>
                  <th>状态</th>
                  <th>下载次数</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="share in shares" :key="share.shareId">
                  <td class="share-filename" :title="share.fileName">{{ share.fileName }}</td>
                  <td>
                    <a :href="share.shareUrl" target="_blank" class="share-link" :title="share.shareUrl">{{ share.shareUrl }}</a>
                    <button class="copy-share-btn-small" @click="copyShareUrl(share.shareUrl)">📋</button>
                  </td>
                  <td>
                    <span :class="['share-status', share.isExpired ? 'expired' : 'active']">
                      {{ share.isExpired ? '已过期' : '有效' }}
                    </span>
                  </td>
                  <td>
                    {{ share.currentDownloads }} / {{ share.maxDownloads || '∞' }}
                  </td>
                  <td>
                    <button class="delete-share-btn" @click="deleteShare(share.shareId)">删除</button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
    <!-- 内建视频/音频播放器 -->
    <div v-if="showPlayer" class="player-overlay" @click.self="showPlayer = false">
      <div class="player-container">
        <div class="player-header">
          <span class="player-title" v-text="playerName"></span>
          <button class="player-close" @click="showPlayer = false">✕</button>
        </div>
        <div class="player-body">
          <img v-if="playerSrc && playerType === 'image'" :src="playerSrc" :alt="playerName" class="player-image"
            @error="console.error('图片加载失败', $event.target.error)" />
          <video v-else-if="playerSrc && playerType === 'video'" :src="playerSrc" controls autoplay
            preload="metadata" playsinline class="player-video"
            @error="console.error('媒体加载失败', $event.target.error)"></video>
          <audio v-else-if="playerSrc && playerType === 'audio'" :src="playerSrc" controls autoplay class="player-audio"
            @error="console.error('媒体加载失败', $event.target.error)"></audio>
        </div>
      </div>
    </div>
    <Footer />
    <div v-if="toastVisible" class="toast" v-text="toastMessage"></div>
  </div>
</template>

<script>
import {
  generateThumbnail,
  blobDigest,
  multipartUpload,
  SIZE_LIMIT,
} from "/assets/main.mjs";
import Dialog from "./Dialog.vue";
import Menu from "./Menu.vue";
import MimeIcon from "./MimeIcon.vue";
import UploadPopup from "./UploadPopup.vue";
import Footer from "./Footer.vue";

export default {
  data: () => ({
    cwd: new URL(window.location).searchParams.get("p") || "",
    files: [],
    folders: [],
    clipboard: null,
    focusedItem: null,
    loading: false,
    order: null,
    search: "",
    searchResults: [],
    searchLoading: false,
    showContextMenu: false,
    showMenu: false,
    showUploadPopup: false,
    uploadProgress: null,
    uploadQueue: [],
    backgroundImageUrl: "",
    showShareModal: false,
    shareFileKey: null,
    shareExpires: 24 * 60,
    shareLink: null,
    shareGenerating: false,
    shareError: null,
    showShareManagement: false,
    shares: [],
    sharesLoading: false,
    pathWidth: 0,
    containerWidth: 0,
    showPlayer: false,
    playerSrc: '',
    playerName: '',
    playerType: '',
    toastVisible: false,
    toastMessage: '',
    // 自定义登录（必须在 data() 中初始化，因为 watch immediate 在 created 之前执行）
    showLogin: !sessionStorage.getItem('flare_auth'),
    loginUsername: '',
    loginPassword: '',
    loginError: '',
    loginLoading: false,
  }),

  mounted() {
    this.updatePathWidth();
    this.resizeObserver = new ResizeObserver(() => {
      this.updatePathWidth();
    });
    const containerEl = this.$refs.toolbarPathRef;
    if (containerEl) {
      this.resizeObserver.observe(containerEl);
    }
    // Esc 关闭播放器
    this._keyHandler = (e) => {
      if (e.key === 'Escape' && this.showPlayer) this.showPlayer = false;
    };
    document.addEventListener('keydown', this._keyHandler);
  },

  beforeUnmount() {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }
    if (this._keyHandler) {
      document.removeEventListener('keydown', this._keyHandler);
    }
  },

  computed: {
    filteredFiles() {
      let files = this.files;
      if (this.search) {
        files = files.filter((file) =>
          file.key.split("/").pop().includes(this.search)
        );
      }
      return files;
    },

    filteredFolders() {
      let folders = this.folders;
      if (this.search) {
        folders = folders.filter((folder) => folder.includes(this.search));
      }
      return folders;
    },

    cwdSegments() {
      if (!this.cwd) return [];
      const path = this.cwd.replace(/\/$/, '');
      const parts = path.split('/').filter(p => p);
      return parts.map((part, index) => ({
        name: part,
        path: parts.slice(0, index + 1).join('/') + '/'
      }));
    },

    visiblePathSegments() {
      if (!this.cwd) return [];
      const path = this.cwd.replace(/\/$/, '');
      const parts = path.split('/').filter(p => p);
      
      const needsEllipsis = this.pathWidth > this.containerWidth;
      
      if (!needsEllipsis || parts.length <= 2) {
        return parts.map((part, index) => ({
          name: part,
          path: parts.slice(0, index + 1).join('/') + '/',
          isCurrent: index === parts.length - 1,
          isEllipsis: false
        }));
      }
      
      return [
        {
          name: parts[0],
          path: parts[0] + '/',
          isCurrent: false,
          isEllipsis: false
        },
        {
          name: '…',
          path: '',
          isCurrent: false,
          isEllipsis: true
        },
        {
          name: parts[parts.length - 1],
          path: parts.join('/') + '/',
          isCurrent: true,
          isEllipsis: false
        }
      ];
    },
  },

  methods: {
    updatePathWidth() {
      const pathEl = this.$refs.pathWidthRef;
      const containerEl = this.$refs.toolbarPathRef;
      if (pathEl && containerEl) {
        this.pathWidth = pathEl.offsetWidth;
        this.containerWidth = containerEl.offsetWidth;
      }
    },

    navigateToPath(path) {
      this.cwd = path;
    },

    handleSearch() {
      if (this.searchTimeout) clearTimeout(this.searchTimeout);
      
      const query = this.search.trim();
      if (!query) {
        this.searchResults = [];
        this.searchLoading = false;
        return;
      }
      
      this.searchLoading = true;
      this.searchTimeout = setTimeout(async () => {
        try {
          const url = new URL('/api/search', window.location.origin);
          url.searchParams.set('q', query);
          url.searchParams.set('path', '');
          
          const res = await this.apiFetch(url);
          if (res.ok) {
            const data = await res.json();
            this.searchResults = data.results || [];
          } else {
            this.searchResults = [];
          }
        } catch (e) {
          this.searchResults = [];
        } finally {
          this.searchLoading = false;
        }
      }, 300);
    },

    navigateToFile(path) {
      this.cwd = path;
      this.search = '';
      this.searchResults = [];
    },

    copyLink(link) {
      const url = new URL(link, window.location.origin);
      navigator.clipboard.writeText(url.toString());
    },

    openShareModal(fileKey) {
      this.shareFileKey = fileKey;
      this.shareLink = null;
      this.shareError = null;
      this.shareExpires = 24 * 60;
      this.showShareModal = true;
    },

    async generateShareLink() {
      if (!this.shareFileKey) return;
      this.shareGenerating = true;
      this.shareError = null;
      this.shareLink = null;

      try {
        const response = await axios.post(`/api/share/${this.shareFileKey}`, {
          expiresInMinutes: this.shareExpires,
        });
        this.shareLink = response.data.shareUrl;
      } catch (error) {
        this.shareError = "生成分享链接失败，请重试";
        console.error("Share error:", error);
      } finally {
        this.shareGenerating = false;
      }
    },

    copyShareLink() {
      if (this.shareLink) {
        navigator.clipboard.writeText(this.shareLink);
        this.showToast("已复制到剪贴板");
      }
    },

    async openShareManagement() {
      this.showShareManagement = true;
      await this.fetchShares();
    },

    async fetchShares() {
      this.sharesLoading = true;
      try {
        const response = await axios.get("/api/shares");
        this.shares = response.data.shares;
      } catch (error) {
        console.error("Fetch shares error:", error);
        this.shares = [];
      } finally {
        this.sharesLoading = false;
      }
    },

    copyShareUrl(url) {
      navigator.clipboard.writeText(url);
      this.showToast("已复制到剪贴板");
    },

    showToast(message) {
      this.toastMessage = message;
      this.toastVisible = true;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toastVisible = false;
      }, 2000);
    },

    async deleteShare(shareId) {
      if (!confirm("确定要删除这个分享链接吗？")) return;
      try {
        await axios.delete(`/api/shares?shareId=${shareId}`);
        await this.fetchShares();
      } catch (error) {
        console.error("Delete share error:", error);
        alert("删除分享链接失败");
      }
    },

    async copyPaste(source, target) {
      const uploadUrl = `/api/write/items/${encodeURIComponent(target)}`;
      await axios.put(uploadUrl, "", {
        headers: { "x-amz-copy-source": encodeURIComponent(source) },
      });
    },

    async createFolder() {
      try {
        const folderName = window.prompt("请输入文件夹名称");
        if (!folderName) return;
        this.showUploadPopup = false;
        const uploadUrl = `/api/write/items/${this.cwd}${folderName}/_$folder$`;
        await axios.put(uploadUrl, "");
        this.fetchFiles();
      } catch (error) {
        this.apiFetch("/api/write/")
          .then((value) => {
            if (value.redirected) window.location.href = value.url;
          })
          .catch(() => { });
        console.log(`Create folder failed`);
      }
    },

    // apiFetch: 统一请求封装，用 credentials:'omit' 防止浏览器自动发送缓存的 Basic Auth 凭证
    // 改为从 sessionStorage 读取 token 放在 X-Flare-Auth 自定义 header 中发送
    apiFetch(url, options = {}) {
      const token = sessionStorage.getItem('flare_auth');
      const headers = { ...(options.headers || {}) };
      if (token) {
        headers['X-Flare-Auth'] = token;
      }
      return fetch(url, {
        ...options,
        credentials: 'omit',
        headers,
      });
    },

    // 自定义登录：用户输入凭据 → 前端生成 token → 发送到后端验证 → 成功则存入 sessionStorage
    async doLogin() {
      this.loginError = '';
      if (!this.loginUsername || !this.loginPassword) {
        this.loginError = '请输入用户名和密码';
        return;
      }
      this.loginLoading = true;
      try {
        const token = btoa(this.loginUsername + ':' + this.loginPassword);
        const res = await fetch('/api/children/', {
          credentials: 'omit',
          headers: { 'X-Flare-Auth': token },
        });
        if (res.ok) {
          sessionStorage.setItem('flare_auth', token);
          // 同时设置 Cookie，让浏览器原生请求（<img>/<video>/<audio>）也能携带认证
          document.cookie = 'flare_auth=' + encodeURIComponent(token) + '; path=/; SameSite=Lax';
          this.showLogin = false;
          this.loginUsername = '';
          this.loginPassword = '';
          await this.$nextTick();
          this.fetchFiles();
        } else if (res.status === 401) {
          this.loginError = '用户名或密码错误';
        } else {
          this.loginError = '登录失败，请重试 (' + res.status + ')';
        }
      } catch (e) {
        this.loginError = '网络错误，请检查连接';
      } finally {
        this.loginLoading = false;
      }
    },

    fetchFiles() {
      this.files = [];
      this.folders = [];
      this.loading = true;
      this.apiFetch(`/api/children/${this.cwd}`)
        .then((res) => {
          if (!res.ok) {
            this.loading = false;
            return null;
          }
          return res.json();
        })
        .then((files) => {
          if (!files) return;
          this.files = files.value;
          if (this.order) {
            this.files.sort((a, b) => {
              if (this.order === "size") {
                return b.size - a.size;
              }
            });
          }
          this.folders = files.folders;
          this.loading = false;
        });
    },

    formatSize(size) {
      const units = ["B", "KB", "MB", "GB", "TB"];
      let i = 0;
      while (size >= 1024) {
        size /= 1024;
        i++;
      }
      return `${size.toFixed(1)} ${units[i]}`;
    },

    onDrop(ev) {
      let files;
      if (ev.dataTransfer.items) {
        files = [...ev.dataTransfer.items]
          .filter((item) => item.kind === "file")
          .map((item) => item.getAsFile());
      } else files = ev.dataTransfer.files;
      this.uploadFiles(files);
    },

    onMenuClick(text) {
      switch (text) {
        case "按照名称排序A-Z":
          this.order = null;
          break;
        case "按照大小递增排序":
          this.order = "大小↑";
          break;
        case "按照大小递减排序":
          this.order = "大小↓";
          break;
        case "退出登录":
          return this.logout();
      }
      this.files.sort((a, b) => {
        if (this.order === "大小↑") {
          return a.size - b.size;
        } else if (this.order === "大小↓") {
          return b.size - a.size;
        } else {
          return a.key.localeCompare(b.key);
        }
      });
    },

    onUploadClicked(fileElement) {
      if (!fileElement.value) return;
      this.uploadFiles(fileElement.files);
      this.showUploadPopup = false;
      fileElement.value = null;
    },

    preview(filePath, contentType) {
      // 图片/视频/音频在当前窗口用内建查看器打开
      if (contentType && /^(image\/|video\/|audio\/|application\/ogg)/.test(contentType)) {
        this.playerSrc = filePath;
        this.playerName = filePath.split('/').pop();
        if (contentType.startsWith('image/')) this.playerType = 'image';
        else if (contentType.startsWith('audio/')) this.playerType = 'audio';
        else this.playerType = 'video';
        this.showPlayer = true;
      } else {
        window.open(filePath);
      }
    },

    logout() {
      sessionStorage.clear();
      document.cookie = 'flare_auth=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
      location.reload();
    },

    async processUploadQueue() {
      if (!this.uploadQueue.length) {
        this.fetchFiles();
        this.uploadProgress = null;
        return;
      }

      /** @type File **/
      const { basedir, file } = this.uploadQueue.pop(0);
      let thumbnailDigest = null;

      if (file.type.startsWith("image/") || file.type === "video/mp4") {
        try {
          const thumbnailBlob = await generateThumbnail(file);
          const digestHex = await blobDigest(thumbnailBlob);

          const thumbnailUploadUrl = `/api/write/items/_$flaredrive$/thumbnails/${digestHex}.png`;
          try {
            await axios.put(thumbnailUploadUrl, thumbnailBlob);
            thumbnailDigest = digestHex;
          } catch (error) {
            this.apiFetch("/api/write/")
              .then((value) => {
                if (value.redirected) window.location.href = value.url;
              })
              .catch(() => { });
            console.log(`Upload ${digestHex}.png failed`);
          }
        } catch (error) {
          console.log(`Generate thumbnail failed`);
        }
      }

      try {
        const uploadUrl = `/api/write/items/${basedir}${file.name}`;
        const headers = {};
        const onUploadProgress = (progressEvent) => {
          var percentCompleted =
            (progressEvent.loaded * 100) / progressEvent.total;
          this.uploadProgress = percentCompleted;
        };
        if (thumbnailDigest) headers["fd-thumbnail"] = thumbnailDigest;
        if (file.size >= SIZE_LIMIT) {
          await multipartUpload(`${basedir}${file.name}`, file, {
            headers,
            onUploadProgress,
          });
        } else {
          await axios.put(uploadUrl, file, { headers, onUploadProgress });
        }
      } catch (error) {
        this.apiFetch("/api/write/")
          .then((value) => {
            if (value.redirected) window.location.href = value.url;
          })
          .catch(() => { });
        console.log(`Upload ${file.name} failed`, error);
      }
      setTimeout(this.processUploadQueue);
    },

    async removeFile(key) {
      const isFolder = key.endsWith("_$folder$");
      const displayName = isFolder ? key.slice(0, -9) : key;
      if (!window.confirm(isFolder ? `确定要删除文件夹 ${displayName} 及其所有内容吗？` : `确定要删除 ${displayName} 吗？`)) return;
      await axios.delete(`/api/write/items/${key}`);
      this.fetchFiles();
    },

    async renameFile(key) {
      const fileName = key.split('/').pop();
      const newName = window.prompt("重命名为:", fileName);
      if (!newName) return;
      await this.copyPaste(key, `${this.cwd}${newName}`);
      await axios.delete(`/api/write/items/${key}`);
      this.fetchFiles();
    },

    async renameFolder(folderPath) {
      const folderName = folderPath.replace(/\/$/, '').split('/').pop();
      const newName = window.prompt("重命名为:", folderName);
      if (!newName) return;

      const oldBasePath = folderPath;
      const newBasePath = folderPath.replace(/[^/]+\/?$/, newName + '/');

      try {
        const allItems = await this.getAllItems(oldBasePath.replace(/\/$/, ''));
        const oldMarker = oldBasePath + '_$folder$';
        const newMarker = newBasePath + '_$folder$';

        await this.copyPaste(oldMarker, newMarker);
        await axios.delete(`/api/write/items/${oldMarker}`);

        for (const item of allItems) {
          const relativePath = item.key.substring(oldBasePath.length);
          const newPath = newBasePath + relativePath;
          await this.copyPaste(item.key, newPath);
          await axios.delete(`/api/write/items/${item.key}`);
        }

        this.fetchFiles();
      } catch (error) {
        console.error('重命名文件夹失败:', error);
        alert('重命名文件夹失败');
      }
    },

    async moveFile(key) {
      // 获取当前的目录结构
      const currentPath = this.cwd; // 当前所在目录
      console.log('moveFile called:', { key, currentPath, folders: this.folders });

      // 递归获取所有文件夹
      const allFolders = await this.getAllFolders();
      console.log('所有可用文件夹:', allFolders);

      // 添加根目录选项
      if (!allFolders.includes('')) {
        allFolders.unshift('');
      }

      // 构建选择列表
      const folderOptions = allFolders.map(folder => {
        const displayName = folder === '' ? '根目录' :
          folder === currentPath ? '当前目录' :
            folder.replace(/.*\/(?!$)|\//g, '') + '/';
        return {
          display: displayName,
          value: folder
        };
      });

      // 创建选择提示
      const options = folderOptions.map((opt, index) =>
        `${index + 1}. ${opt.display}`
      ).join('\n');

      const promptText = `请选择目标目录(输入数字):\n${options}\n`;
      const selection = window.prompt(promptText);

      if (!selection) return;

      const selectedIndex = parseInt(selection) - 1;
      if (isNaN(selectedIndex) || selectedIndex < 0 || selectedIndex >= folderOptions.length) {
        alert('无效的选择');
        return;
      }

      const targetPath = folderOptions[selectedIndex].value;

      // 如果目标是当前目录，则不进行移动
      if (targetPath === currentPath) {
        alert('目标目录与源目录相同，无需移动');
        return;
      }

      // 获取文件名（对于文件夹需要特殊处理）
      let fileName;
      if (key.endsWith('_$folder$')) {
        // 对于文件夹，取去掉 _$folder$ 后的路径最后一部分
        let folderPath = key.slice(0, -9);
        // 去除尾部斜杠（如果有）
        if (folderPath.endsWith('/')) {
          folderPath = folderPath.slice(0, -1);
        }
        fileName = folderPath.split('/').pop();
      } else {
        fileName = key.split('/').pop();
      }

      // 修复：正确处理目标路径，避免双斜杠
      const normalizedPath = targetPath === '' ? '' : (targetPath.endsWith('/') ? targetPath : targetPath + '/');

      try {
        // 如果是目录（以_$folder$结尾），则需要移动整个目录内容
        if (key.endsWith('_$folder$')) {
          // 获取源目录的基础路径（移除_$folder$后缀并确保没有尾部斜杠）
          let folderPath = key.slice(0, -9);
          if (folderPath.endsWith('/')) {
            folderPath = folderPath.slice(0, -1);
          }
          const sourceBasePath = folderPath + '/';
          // 获取目标目录的基础路径
          const targetBasePath = normalizedPath + fileName + '/';

          // 递归获取所有子文件和子目录
          const allItems = await this.getAllItems(folderPath);

          console.log('移动文件夹:', {
            sourceKey: key,
            sourceBasePath,
            targetBasePath,
            fileName,
            allItems
          });

          // 显示进度提示
          const totalItems = allItems.length;
          let processedItems = 0;
          // 收集所有需要创建的子文件夹标记
          const subFolders = new Set();

          // 移动所有项目
          for (const item of allItems) {
            const relativePath = item.key.substring(sourceBasePath.length);
            const newPath = targetBasePath + relativePath;

            console.log('移动项目:', item.key, '->', newPath);

            try {
              // 复制到新位置
              console.log('复制:', sourceBasePath + relativePath, '->', newPath);
              await this.copyPaste(sourceBasePath + relativePath, newPath);
              // 删除原位置
              console.log('删除:', sourceBasePath + relativePath);
              await axios.delete(`/api/write/items/${encodeURIComponent(sourceBasePath + relativePath)}`);

              // 收集子文件夹路径
              const pathParts = relativePath.split('/');
              if (pathParts.length > 1) {
                // 文件在子文件夹中，需要创建子文件夹标记
                for (let i = 1; i < pathParts.length; i++) {
                  const subFolderPath = targetBasePath + pathParts.slice(0, i).join('/');
                  subFolders.add(subFolderPath);
                }
              }

              // 更新进度
              processedItems++;
              this.uploadProgress = (processedItems / totalItems) * 100;
            } catch (error) {
              console.error(`移动 ${item.key} 失败:`, error);
            }
          }

          // 创建所有子文件夹标记
          console.log('创建子文件夹标记:', Array.from(subFolders));
          for (const subFolder of subFolders) {
            const subFolderMarker = subFolder + '/_$folder$';
            try {
              await axios.put(`/api/write/items/${subFolderMarker}`, '');
            } catch (error) {
              console.error(`创建文件夹标记 ${subFolderMarker} 失败:`, error);
            }
          }

          // 创建目标目录标记
          const targetFolderPath = targetBasePath + '_$folder$';
          console.log('创建目标目录标记:', targetFolderPath);
          await axios.put(`/api/write/items/${targetFolderPath}`, '');
          // 删除原目录标记
          await axios.delete(`/api/write/items/${key}`);

          // 清除进度
          this.uploadProgress = null;

          // 刷新文件列表（留在当前目录）
          this.fetchFiles();
        } else {
          // 单文件移动逻辑
          const targetFilePath = normalizedPath + fileName;
          await this.copyPaste(key, targetFilePath);
          await axios.delete(`/api/write/items/${key}`);
          // 刷新文件列表（留在当前目录）
          this.fetchFiles();
        }
      } catch (error) {
        console.error('移动失败:', error);
        alert('移动失败,请检查目标路径是否正确');
      }
    },

    // 新增：递归获取目录下所有文件和子目录（不包含_$folder$标记文件）
    async getAllItems(prefix) {
      const items = [];
      let marker = null;

      // 去除尾部斜杠，避免双斜杠问题
      const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

      do {
        const url = new URL(`/api/children/${normalizedPrefix}`, window.location.origin);
        if (marker) {
          url.searchParams.set('marker', marker);
        }

        const response = await this.apiFetch(url);
        const data = await response.json();

        // 添加文件（过滤掉_$folder$标记文件）
        const files = data.value.filter(item => !item.key.endsWith('_$folder$'));
        items.push(...files);

        // 处理子目录
        for (const folder of data.folders) {
          // 递归获取子目录内容（folder 已经带尾部斜杠，需要去除）
          const folderPrefix = folder.endsWith('/') ? folder.slice(0, -1) : folder;
          const subItems = await this.getAllItems(folderPrefix);
          items.push(...subItems);
        }

        marker = data.marker;
      } while (marker);

      return items;
    },

    // 递归获取所有文件夹
    async getAllFolders(prefix = '') {
      const folders = [];
      let marker = null;

      const normalizedPrefix = prefix.endsWith('/') ? prefix.slice(0, -1) : prefix;

      do {
        const url = new URL(`/api/children/${normalizedPrefix}`, window.location.origin);
        if (marker) {
          url.searchParams.set('marker', marker);
        }

        const response = await this.apiFetch(url);
        const data = await response.json();

        // 添加当前目录的直接子文件夹
        for (const folder of data.folders) {
          const folderPath = folder.endsWith('/') ? folder.slice(0, -1) : folder;
          folders.push(folderPath);
          // 递归获取子文件夹的子文件夹
          const subFolders = await this.getAllFolders(folderPath);
          folders.push(...subFolders);
        }

        marker = data.marker;
      } while (marker);

      return folders;
    },

    uploadFiles(files) {
      if (this.cwd && !this.cwd.endsWith("/")) this.cwd += "/";

      const uploadTasks = Array.from(files).map((file) => ({
        basedir: this.cwd,
        file,
      }));
      this.uploadQueue.push(...uploadTasks);
      setTimeout(() => this.processUploadQueue());
    },
  },

  watch: {
    cwd: {
      handler() {
        if (this.showLogin) return;
        this.fetchFiles();
        this.$nextTick(() => {
          requestAnimationFrame(() => {
            this.updatePathWidth();
          });
        });
        const url = new URL(window.location);
        if ((url.searchParams.get("p") || "") !== this.cwd) {
          this.cwd
            ? url.searchParams.set("p", this.cwd)
            : url.searchParams.delete("p");
          window.history.pushState(null, "", url.toString());
        }
        document.title = this.cwd.replace(/.*\/(?!$)|\//g, "") === "/" 
            ? "PAN - 网盘文件库"
            :`${this.cwd.replace(/.*\/(?!$)|\//g, "") || "/" } - 网盘文件库`;
      },
      immediate: true,
    },
  },

  created() {
    // 初始化 axios：禁止浏览器自动发送缓存的 Basic Auth 凭证，
    // 改为从 sessionStorage 读取 token 通过自定义 header 发送
    axios.defaults.withCredentials = false;
    axios.interceptors.request.use((config) => {
      const token = sessionStorage.getItem('flare_auth');
      if (token) {
        config.headers = config.headers || {};
        config.headers['X-Flare-Auth'] = token;
      }
      return config;
    });
    window.addEventListener("popstate", (ev) => {
      const searchParams = new URL(window.location).searchParams;
      if (searchParams.get("p") !== this.cwd)
        this.cwd = searchParams.get("p") || "";
    });
  },

  components: {
    Dialog,
    Menu,
    MimeIcon,
    UploadPopup,
    Footer,
  },
};
</script>

<style>
.main {
  display: flex;
  height: 100%;
  /* background-image: url(/assets/bg-light.webp); */
  background-size: cover;
  background-position: center;
  overflow-y: auto;
  flex-direction: column;
}

.app-bar {
  z-index: 2;
  position: sticky;
  top: 0;
  padding: 8px;
  background-color: white;
  display: flex;
}

@media (max-width: 400px) {
  .menu-button {
    margin: 0;
    padding: 0;
  }

  button.circle {
    padding: 0 8px;
  }
  .menu-button-text {
    display: none !important;
  }
}

@media (max-width: 340px) {
  .app-title-container {
    display: none !important;
  }
}

.menu-button {
  display: flex;
  position: relative;
  margin-left: 10px;
  padding: 0 10px;
}

.file-list-container {
  margin: 20px auto;
  padding: 10px;
  width: 60%;
  max-width: 95%;
  background: rgba(255, 255, 255, 0.5);
  backdrop-filter: blur(10px);
  border-radius: 12px;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
  transition: width 0.3s ease;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 10px;
  padding: 10px 0;
  border-bottom: 1px solid rgba(0, 0, 0, 0.1);
  margin-bottom: 10px;
}

.toolbar-path {
  display: flex;
  align-items: center;
  gap: 8px;
  flex: 1;
  overflow: hidden;
  min-width: 0;
  position: relative;
}

.toolbar-path .path-text {
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  color: #666;
  font-size: 14px;
}

.path-width-measure {
  position: absolute;
  visibility: hidden;
  white-space: nowrap;
  font-size: 14px;
  height: 0;
  overflow: hidden;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  letter-spacing: normal;
  word-spacing: normal;
}

.search-results {
  background: #fff;
  border-radius: 10px;
  margin: 10px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.search-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  background: #f5f5f5;
  border-bottom: 1px solid #eee;
}

.search-count {
  font-size: 14px;
  color: #666;
}

.search-close {
  background: none;
  border: none;
  font-size: 18px;
  color: #999;
  cursor: pointer;
  padding: 0 8px;
  line-height: 1;
}

.search-close:hover {
  color: #333;
}

.search-list {
  list-style: none;
  padding: 0;
  margin: 0;
}

.search-item {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  cursor: pointer;
  transition: background-color 0.2s;
  border-bottom: 1px solid #f5f5f5;
}

.search-item:last-child {
  border-bottom: none;
}

.search-item:hover {
  background-color: #f8f9fa;
}

.search-icon {
  margin-right: 12px;
  flex-shrink: 0;
}

.search-info {
  flex: 1;
  min-width: 0;
}

.search-name {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #333;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.search-path {
  display: block;
  font-size: 12px;
  color: #999;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.search-size {
  font-size: 12px;
  color: #999;
  margin-left: 12px;
  flex-shrink: 0;
}

.path-link {
  background: none;
  border: none;
  color: #4a90d9;
  font-size: 14px;
  cursor: pointer;
  padding: 0;
  margin: 0;
  text-decoration: underline;
}

.path-link:hover {
  color: #357abd;
}

.path-current {
  color: #333;
  font-size: 14px;
  font-weight: 500;
}

.path-ellipsis {
  color: #999;
  font-size: 14px;
  margin: 0 2px;
}

.path-separator {
  color: #999;
  margin: 0 2px;
  font-size: 14px;
}

.toolbar-actions {
  display: flex;
  gap: 10px;
  flex-shrink: 0;
}

.toolbar-icon-btn {
  padding: 8px;
  background: transparent;
  color: #666;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  transition: background-color 0.2s, color 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.toolbar-icon-btn:hover {
  background: rgba(0, 0, 0, 0.08);
  color: #333;
}

.toolbar-icon-btn:active {
  background: rgba(0, 0, 0, 0.12);
}

@media (max-width: 1280px) {
  .file-list-container {
    width: 768px;
    padding: 10px;
  }
}

.menu-button>button {
  transition: background-color 0.2s ease;
}

.menu-button>button:hover {
  background-color: rgb(212, 212, 212);
}

.menu {
  position: absolute;
  top: 100%;
  right: 0;
}

.share-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.share-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 400px;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
}

.share-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 20px;
  background: #f5f5f5;
  border-bottom: 1px solid #ddd;
}

.share-modal-header h3 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  color: #666;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.close-btn:hover {
  color: #333;
}

.share-modal-body {
  padding: 20px;
}

.share-option {
  margin-bottom: 16px;
}

.share-option label {
  display: block;
  margin-bottom: 8px;
  font-size: 14px;
  color: #666;
}

.share-select {
  width: 100%;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  cursor: pointer;
}

.generate-share-btn {
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  margin-bottom: 16px;
}

.generate-share-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.generate-share-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}

.share-link-container {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.share-link-input {
  flex: 1;
  padding: 10px;
  border: 1px solid #ddd;
  border-radius: 8px;
  font-size: 13px;
  color: #333;
  background: #f9f9f9;
  word-break: break-all;
}

.copy-share-btn {
  padding: 10px 16px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.copy-share-btn:hover {
  background: #45a049;
}

.share-error {
  color: #ef4444;
  font-size: 14px;
  text-align: center;
}

.share-management-modal {
  background: white;
  border-radius: 12px;
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.2);
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.share-management-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.shares-loading,
.shares-empty {
  text-align: center;
  padding: 40px;
  color: #666;
  font-size: 16px;
}

.shares-table-container {
  overflow-x: auto;
}

.shares-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 14px;
}

.shares-table th,
.shares-table td {
  padding: 12px 16px;
  text-align: left;
  border-bottom: 1px solid #eee;
}

.shares-table th {
  background: #f5f5f5;
  font-weight: 600;
  color: #333;
  white-space: nowrap;
}

.shares-table tr:hover {
  background: #f9f9f9;
}

.share-filename {
  max-width: 180px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.share-link {
  color: #667eea;
  text-decoration: none;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: inline-block;
  vertical-align: middle;
}

.share-link:hover {
  text-decoration: underline;
}

.copy-share-btn-small {
  background: #f0f0f0;
  border: none;
  border-radius: 4px;
  padding: 4px 8px;
  font-size: 12px;
  cursor: pointer;
  vertical-align: middle;
  margin-left: 4px;
}

.copy-share-btn-small:hover {
  background: #e0e0e0;
}

.share-status {
  display: inline-block;
  padding: 4px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: 600;
}

.share-status.active {
  background: #d4edda;
  color: #155724;
}

.share-status.expired {
  background: #f8d7da;
  color: #721c24;
}

.delete-share-btn {
  padding: 6px 12px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 13px;
  cursor: pointer;
  transition: background 0.3s ease;
}

.delete-share-btn:hover {
  background: #c82333;
}

/* 内建视频播放器 */
.player-overlay {
  position: fixed;
  inset: 0;
  z-index: 9999;
  background: rgba(0,0,0,0.9);
  display: flex;
  align-items: center;
  justify-content: center;
}

.player-container {
  width: 90vw;
  max-width: 1200px;
  max-height: 90vh;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.player-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  background: #1a1a1a;
  color: #ccc;
}

.player-title {
  font-size: 14px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  margin-right: 12px;
}

.player-close {
  background: none;
  border: none;
  color: #ccc;
  font-size: 20px;
  cursor: pointer;
  padding: 4px 10px;
  border-radius: 4px;
  transition: background 0.2s;
}

.player-close:hover {
  background: rgba(255,255,255,0.2);
  color: #fff;
}

.player-body {
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 1;
  min-height: 0;
}

.player-video {
  max-width: 100%;
  max-height: calc(90vh - 50px);
  outline: none;
}

.player-image {
  max-width: 100%;
  max-height: calc(90vh - 50px);
  object-fit: contain;
  cursor: zoom-out;
}

.player-audio {
  width: 80%;
  max-width: 500px;
  margin: 0 auto;
  outline: none;
}

.toast {
  position: fixed;
  bottom: 40px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(0, 0, 0, 0.8);
  color: #fff;
  padding: 12px 24px;
  border-radius: 8px;
  font-size: 14px;
  z-index: 10000;
  animation: toast-in 0.3s ease;
}

@keyframes toast-in {
  from { opacity: 0; transform: translateX(-50%) translateY(10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}

/* 登录表单 */
.login-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 20px;
}

.login-card {
  background: white;
  border-radius: 16px;
  padding: 40px;
  width: 100%;
  max-width: 380px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-header h2 {
  margin: 12px 0 0;
  font-size: 22px;
  color: #333;
  font-weight: 600;
}

.login-form {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.login-field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.login-field label {
  font-size: 13px;
  font-weight: 600;
  color: #555;
}

.login-field input {
  padding: 12px 16px;
  border: 2px solid #e0e0e0;
  border-radius: 10px;
  font-size: 15px;
  transition: border-color 0.2s;
  outline: none;
}

.login-field input:focus {
  border-color: #667eea;
}

.login-field input:disabled {
  opacity: 0.6;
  background: #f5f5f5;
}

.login-error {
  color: #e74c3c;
  font-size: 13px;
  text-align: center;
  padding: 8px;
  background: #fdf0ef;
  border-radius: 8px;
}

.login-btn {
  padding: 14px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border: none;
  border-radius: 10px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
}

.login-btn:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(102, 126, 234, 0.4);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
}
</style>
