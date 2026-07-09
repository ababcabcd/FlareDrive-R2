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
    <div v-if="uploadProgress !== null" class="upload-progress-bar">
      <span class="upload-progress-label">{{ uploadProgressLabel || '上传中' }} <em>{{ Math.round(uploadProgress) }}%</em></span>
      <progress :value="uploadProgress" max="100"></progress>
      <button class="upload-cancel-btn" title="取消上传" @click="cancelUpload">✕</button>
    </div>
    <div v-if="downloadProgress !== null" class="upload-progress-bar">
      <span class="upload-progress-label">{{ downloadProgressLabel || '下载中' }} <em>{{ Math.round(downloadProgress) }}%</em></span>
      <progress :value="downloadProgress" max="100"></progress>
      <button class="upload-cancel-btn" title="取消下载" @click="cancelDownload">✕</button>
    </div>
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
          <div @click="preview(rawUrl(file.key), file.httpMetadata.contentType, file.key.split('/').pop())" @contextmenu.prevent="
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
      <ul v-else class="contextmenu-list" @click.stop>
        <li>
          <button @click.stop="renameFile(focusedItem.key)">
            <span>重命名</span>
          </button>
        </li>
        <li>
          <a :href="rawUrl(focusedItem.key)" target="_blank" download @click.stop>
            <span>下载</span>
          </a>
        </li>
        <li>
          <button @click.stop="multiThreadDownload(focusedItem.key, focusedItem.key.split('/').pop())">
            <span>多线程下载</span>
          </button>
        </li>
        <li>
          <button @click.stop="clipboard = focusedItem.key">
            <span>复制</span>
          </button>
        </li>
        <li>
          <button @click.stop="moveFile(focusedItem.key)">
            <span>移动</span>
          </button>
        </li>
        <li>
          <button @click.stop="copyLink(rawUrl(focusedItem.key))">
            <span>复制链接</span>
          </button>
        </li>
        <li>
          <button @click.stop="openShareModal(focusedItem.key)">
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
          <video v-else-if="playerSrc && playerType === 'video'" ref="videoPlayer" :src="playerSrc" controls autoplay
            preload="metadata" playsinline class="player-video"
            @error="onVideoError"
            @loadedmetadata="_onVideoLoadedMetadata"
            @timeupdate="_onVideoTimeUpdate"
            @seeked="_onVideoSeeked"></video>
          <audio v-else-if="playerSrc && playerType === 'audio'" :src="playerSrc" controls autoplay class="player-audio"
            @error="console.error('媒体加载失败', $event.target.error)"></audio>
        </div>
      </div>
    </div>
    <Footer />
    <div v-if="toastVisible" class="toast">
      <span class="toast-text" v-text="toastMessage"></span>
      <button v-if="toastAction" class="toast-btn" @click="toastAction.handler()" v-text="toastAction.label"></button>
    </div>
  </div>
</template>

<script>
import {
  generateThumbnail,
  blobDigest,
  multipartUpload,
  SIZE_LIMIT,
} from "/assets/main.mjs";
import { optimizeVideo, isAlreadyFaststart } from "./videoProcess.mjs";
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
    uploadProgressLabel: '',
    uploadAbortCtrl: null,
    uploadQueue: [],
    downloadProgress: null,
    downloadProgressLabel: '',
    downloadAbortCtrl: null,
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
    videoRetryCount: 0,
    // 视频多线程预取
    _prefetchCtrl: null,
    _prefetchFileSize: 0,
    _prefetchEndByte: 0,
    _prefetchActive: false,
    _prefetchBatchRunning: false,
    _prefetchMetadataHandled: false,
    _prefetchSeekTimer: null,
    _prefetchUrl: '',
    toastVisible: false,
    toastMessage: '',
    toastAction: null, // { label: string, handler: () => void } | null
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

    // 注册 Service Worker 用于视频/音频多线程预取加速
    this._swReadyPromise = Promise.resolve(false);
    if ('serviceWorker' in navigator) {
      this._swReadyPromise = new Promise((resolve) => {
        let resolved = false;
        const done = (ok) => { if (!resolved) { resolved = true; resolve(ok); } };

        navigator.serviceWorker
          .register('/sw.mjs', { scope: '/', updateViaCache: 'none' })
          .then(reg => {
            console.log('[App] SW 注册成功', reg.scope);
            // 立即检查更新，确保加载最新 sw.mjs
            reg.update().catch(() => {});

            const pingSw = () => {
              if (!navigator.serviceWorker.controller) return;
              const channel = new MessageChannel();
              channel.port1.onmessage = (e) => {
                console.log('[App] SW ping 响应:', e.data);
              };
              navigator.serviceWorker.controller.postMessage('ping', [channel.port2]);
            };

            // 如果已经激活直接放行
            if (navigator.serviceWorker.controller) {
              console.log('[App] SW 已控制页面');
              pingSw();
              done(true);
              return;
            }
            // 等 activate + claim
            const onState = () => {
              if (navigator.serviceWorker.controller) {
                console.log('[App] SW 已激活并控制页面');
                pingSw();
                done(true);
              }
            };
            if (reg.installing) reg.installing.addEventListener('statechange', onState);
            if (reg.waiting) onState();
            reg.addEventListener('updatefound', () => {
              if (reg.installing) reg.installing.addEventListener('statechange', onState);
            });
            // 最多等 2s，超时也继续
            setTimeout(() => done(false), 2000);
          })
          .catch(err => {
            console.warn('[App] SW 注册失败:', err.message);
            done(false);
          });
      });
    }
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
        const response = await axios.post(`/api/share/_fd_?name=${encodeURIComponent(this.shareFileKey)}`, {
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

    showToast(message, action) {
      this.toastMessage = message;
      this.toastAction = action || null;
      this.toastVisible = true;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => {
        this.toastVisible = false;
        this.toastAction = null;
      }, action ? 8000 : 2000);
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
      const uploadUrl = `/api/write/items/_fd_?name=${encodeURIComponent(target)}`;
      await axios.put(uploadUrl, "", {
        headers: { "x-amz-copy-source": encodeURIComponent(source) },
      });
    },

    async createFolder() {
      try {
        const folderName = window.prompt("请输入文件夹名称");
        if (!folderName) return;
        this.showUploadPopup = false;
        const uploadUrl = `/api/write/items/_fd_?name=${encodeURIComponent(this.cwd + folderName + "/_$folder$")}`;
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

    // 文件名含中文/特殊字符时，放在 URL 路径里会导致 wrangler 路由 404/405，
    // 因此统一用 /_fd_ 占位段让路由命中，真实 key 走 name query 参数
    rawUrl(key) {
      return `/raw/_fd_?name=${encodeURIComponent(key)}`;
    },
    childrenUrl(prefix) {
      // 根目录（空前缀）用尾斜杠形式：wrangler 会把空的 ?name= 解析成 null，
      // 导致回退到占位段 _fd_ 而列出空目录
      if (!prefix) return `/api/children/`;
      return `/api/children/_fd_?name=${encodeURIComponent(prefix)}`;
    },

    // 网页内多线程（分块 Range）下载：
    // 1) HEAD 拿文件大小/类型；2) 按大小决定线程数(2-8)；
    // 3) 优先用 File System Access API 流式落盘（大文件不占满内存），
    //    不支持时回退为合并 Blob 触发下载；超大文件回退原生单线程下载。
    async multiThreadDownload(key, displayName) {
      if (this.downloadProgress !== null) {
        this.showToast('已有下载任务进行中');
        return;
      }
      const token = sessionStorage.getItem('flare_auth');
      const authHeaders = token ? { 'X-Flare-Auth': token } : {};
      const url = this.rawUrl(key);

      // 1) HEAD 获取文件大小与类型
      let total = 0;
      let contentType = 'application/octet-stream';
      try {
        const head = await this.apiFetch(url, { method: 'HEAD' });
        total = parseInt(head.headers.get('Content-Length') || '0', 10);
        contentType = head.headers.get('Content-Type') || contentType;
      } catch (e) {
        console.error('HEAD 失败，回退到原生下载', e);
        window.open(url, '_blank');
        return;
      }
      // 小文件直接原生下载即可
      if (!total || total < 1024 * 1024) {
        window.open(url, '_blank');
        return;
      }

      // 2) 是否支持 File System Access（流式落盘，避免大文件占满内存）
      let writable = null;
      const useFS = typeof window.showSaveFilePicker === 'function';
      if (useFS) {
        try {
          const handle = await window.showSaveFilePicker({ suggestedName: displayName });
          writable = await handle.createWritable();
        } catch (e) {
          if (e && e.name === 'AbortError') return; // 用户取消保存
          writable = null; // 其它错误回退到 Blob
        }
      }

      // 大文件且不支持流式落盘：内存风险，回退原生单线程下载
      const SAFE_LIMIT = 1.5 * 1024 * 1024 * 1024;
      if (!writable && total > SAFE_LIMIT) {
        this.showToast('文件过大，浏览器内存受限，已改用原生下载');
        window.open(url, '_blank');
        return;
      }

      // 3) 分块
      const threads = Math.max(2, Math.min(8, Math.ceil(total / (25 * 1024 * 1024))));
      const chunkSize = Math.ceil(total / threads);
      const ranges = [];
      for (let i = 0; i < threads; i++) {
        const start = i * chunkSize;
        const end = Math.min(total - 1, start + chunkSize - 1);
        if (start > end) break;
        ranges.push({ start, end, index: i });
      }

      // 4) 并行下载（带并发上限），按序写入/合并
      this.downloadProgress = 0;
      this.downloadProgressLabel = `下载 ${displayName} ...`;
      const ctrl = new AbortController();
      this.downloadAbortCtrl = ctrl;
      let received = 0;
      const buffers = writable ? null : new Array(ranges.length);
      let writeChain = Promise.resolve();

      const updateProgress = () => {
        const pct = total ? (received / total) * 100 : 0;
        this.downloadProgress = Math.min(99, pct);
        this.downloadProgressLabel = `下载 ${displayName} ... ${Math.round(pct)}%`;
      };

      const worker = async (r) => {
        const res = await this.apiFetch(url, {
          method: 'GET',
          headers: { ...authHeaders, Range: `bytes=${r.start}-${r.end}` },
          signal: ctrl.signal,
        });
        if (res.status !== 206 && res.status !== 200) {
          throw new Error(`分块 ${r.index} 返回 ${res.status}`);
        }
        // 流式读取：每收到一个网络 chunk 就更新进度，避免整段 arrayBuffer 完成前进度卡在 0%
        const reader = res.body.getReader();
        const chunks = [];
        let chunkReceived = 0;
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          chunkReceived += value.length;
          received += value.length;
          updateProgress();
        }
        // 合并本分块
        const buf = new Uint8Array(chunkReceived);
        let offset = 0;
        for (const chunk of chunks) {
          buf.set(chunk, offset);
          offset += chunk.length;
        }
        if (writable) {
          // 顺序写：每个写操作挂在前一个之后，保证字节顺序
          writeChain = writeChain.then(() => writable.write(buf));
        } else {
          buffers[r.index] = buf;
        }
      };

      // 并发池：控制同时进行的请求数为 threads
      const pool = async () => {
        const queue = [...ranges];
        const runners = Array.from({ length: threads }, async () => {
          while (queue.length) {
            const r = queue.shift();
            await worker(r);
          }
        });
        await Promise.all(runners);
        if (writable) {
          await writeChain;
          await writable.close();
        }
      };

      try {
        await pool();
        if (writable) {
          this.downloadProgress = 100;
          this.downloadProgressLabel = `下载完成: ${displayName}`;
          await new Promise((res) => setTimeout(res, 400));
        } else {
          const blob = new Blob(buffers, { type: contentType });
          const objUrl = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = objUrl;
          a.download = displayName;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          setTimeout(() => URL.revokeObjectURL(objUrl), 1000);
          this.downloadProgress = 100;
          this.downloadProgressLabel = `下载完成: ${displayName}`;
        }
      } catch (e) {
        if (ctrl.signal.aborted) {
          this.downloadProgressLabel = '已取消下载';
        } else {
          console.error('多线程下载失败', e);
          this.showToast('多线程下载失败，已回退到原生下载');
          window.open(url, '_blank');
        }
        if (writable) { try { await writable.close(); } catch (_) {} }
      } finally {
        this.downloadAbortCtrl = null;
        setTimeout(() => { this.downloadProgress = null; }, 600);
      }
    },

    cancelDownload() {
      if (this.downloadAbortCtrl) this.downloadAbortCtrl.abort();
      this.downloadProgress = null;
      this.downloadProgressLabel = '已取消下载';
      this.downloadAbortCtrl = null;
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
      this.loading = true;
      this.apiFetch(this.childrenUrl(this.cwd))
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

    async preview(filePath, contentType, displayName) {
      // 显示名优先用调用方传入的真实文件名；否则从 URL 的 name 参数解码还原
      // （兼容 /raw/_fd_?name=ENCODED 形式，避免标题显示成编码后的 URL）
      let name = displayName;
      if (!name) {
        const u = new URL(filePath, window.location.origin);
        const n = u.searchParams.get('name');
        name = n !== null ? decodeURIComponent(n).split('/').pop() : filePath.split('/').pop();
      }
      const type = this._mediaType(contentType, name);
      if (type) {
        // 图片/视频/音频在当前窗口用内建查看器打开
        this.playerSrc = filePath;
        this.playerName = name;
        this.playerType = type;
        this.videoRetryCount = 0;
        this.showPlayer = true;
        // 预热浏览器缓存：raw 端点已改为 cacheable，预取 chunk 会被 <video> 的 Range 请求命中
        if (this.playerType === 'video' && this.playerSrc.startsWith('/raw/')) {
          this.$nextTick(() => this._startVideoPrefetch());
        }
      } else {
        window.open(filePath);
      }
    },

    // 根据 Content-Type 与扩展名判定媒体类型，确保 R2 存为 octet-stream 的旧文件也能在当前页预览
    _mediaType(contentType, name) {
      if (contentType && /^(image\/|video\/|audio\/|application\/ogg)/.test(contentType)) {
        if (contentType.startsWith('image/')) return 'image';
        if (contentType.startsWith('audio/')) return 'audio';
        return 'video';
      }
      // 兜底：按扩展名判断（Content-Type 缺失/错误时）
      const ext = (name.split('.').pop() || '').toLowerCase();
      const VIDEO = ['mp4', 'm4v', 'mov', 'webm', 'ogv', 'ogg'];
      const AUDIO = ['mp3', 'wav', 'flac', 'aac', 'm4a', 'oga'];
      const IMAGE = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg', 'avif'];
      if (VIDEO.includes(ext)) return 'video';
      if (AUDIO.includes(ext)) return 'audio';
      if (IMAGE.includes(ext)) return 'image';
      return null;
    },

    async onVideoError(event) {
      const video = event.target;
      const currentSrc = video.currentSrc || video.src;
      console.error('[App] 视频播放失败', currentSrc, video.error);

      // 只兜底一次，避免循环
      if (this.videoRetryCount > 0) return;
      this.videoRetryCount++;

      // 如果当前已经是最终 CDN 直链（非 /raw/），不再 fallback
      if (!currentSrc.startsWith('/raw/') && !currentSrc.startsWith(window.location.origin)) {
        console.log('[App] 已是直链，不再 fallback');
        return;
      }

      // 播放失败时尝试 fallback 到 CDN 直链
      try {
        const res = await fetch(currentSrc, { method: 'HEAD', redirect: 'follow' });
        const directUrl = res.url;
        if (directUrl && directUrl !== currentSrc) {
          console.log('[App] fallback 到直链', directUrl);
          video.src = directUrl;
          video.load();
          video.play().catch(() => {});
        }
      } catch (e) {
        console.error('[App] fallback 直链失败', e);
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
        this.uploadProgressLabel = '';
        return;
      }

      /** @type File **/
      const { basedir, file } = this.uploadQueue.pop(0);
      let uploadFile = file;
      let thumbnailDigest = null;

      // 为本次上传创建中止控制器，供取消按钮中断在途请求
      this.uploadAbortCtrl = new AbortController();
      const signal = this.uploadAbortCtrl.signal;

      // —— 视频 faststart 优化（moov atom 前移） ——
      if (file.type?.startsWith('video/')) {
        const FFMPEG_MAX = 1500 * 1024 * 1024; // 1.5GB
        if (file.size > FFMPEG_MAX) {
          // 超限文件先快速检测 moov 是否已在头部，避免对已优化文件弹出无用提示
          const alreadyFast = await isAlreadyFaststart(file);
          if (!alreadyFast) {
            const base = file.name.replace(/\.[^.]+$/, '');
            const ext = file.name.split('.').pop();
            const sq = (s) => `'${s.replace(/'/g, "'\\''")}'`;
            const outName = `${base}_faststart.${ext}`;
            const cmd = `ffmpeg -i ${sq(file.name)} -c copy -movflags faststart ${sq(outName)}`;
            this.showToast(`${file.name} 超过 1.5GB，请本地运行：${cmd}`, {
              label: '复制命令',
              handler: () => {
                navigator.clipboard.writeText(cmd);
                this.showToast('命令已复制');
              },
            });
          }
        } else {
          this.showToast(`正在优化视频：${file.name}`);
          this.uploadProgressLabel = `优化 ${file.name} ...`;
          this.uploadProgress = 0;
          try {
            const result = await optimizeVideo(file, (pct) => {
              this.uploadProgress = Math.round(pct * 100);
            }, signal);
            if (signal.aborted) return; // 优化期间被取消
            if (result.optimized) {
              uploadFile = result.file;
              this.showToast(`视频优化完成，开始上传`);
              console.log(`[App] ffmpeg faststart 完成: ${(file.size/1024/1024).toFixed(0)}MB -> ${(uploadFile.size/1024/1024).toFixed(0)}MB`);
            }
          } catch (e) {
            if (signal.aborted) return; // 取消导致的 abort 不算失败
            throw e;
          }
        }
      }

      // —— 缩略图（仅图片，视频缩略图本项目不展示） ——
      if (uploadFile.type.startsWith("image/")) {
        try {
          this.uploadProgressLabel = '生成缩略图 ...';
          const thumbnailBlob = await generateThumbnail(uploadFile);
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

      // 模拟进度兜底：Safari / localhost 下 XHR 只触发一次 100% 进度事件，需平滑推进。
      // 关键：仅在「真实进度超过 400ms 未更新」时才用模拟值兜底，避免真实网络下
      // 模拟值抢先冲到 95% 并因守卫条件掩盖真实进度（表现为卡在 95%）。
      // 声明在 try 外，确保 catch / 取消分支都能 clearInterval。
      let simulateTimer = null;
      let lastRealProgressAt = Date.now();
      try {
        this.uploadProgressLabel = `服务器接收处理中，${uploadFile.name} ...`;
        this.uploadProgress = 0;
        const uploadUrl = `/api/write/items/_fd_?name=${encodeURIComponent(basedir + uploadFile.name)}`;
        const headers = {};

        simulateTimer = setInterval(() => {
          // 仅在真实进度长时间停滞（>3s，真正卡住/等待服务器确认）时才温和推进 1%，
          // 避免掩盖正常上传的实时心跳（之前 400ms+4% 会把真停滞伪装成平滑增长）
          if (Date.now() - lastRealProgressAt > 3000 && this.uploadProgress < 99) {
            this.uploadProgress = Math.min(this.uploadProgress + 1, 99);
          }
        }, 200);

        const onUploadProgress = (progressEvent) => {
          if (progressEvent.total) {
            const pct = (progressEvent.loaded * 100) / progressEvent.total;
            const capped = Math.min(pct, 98);
            // 真实进度优先，但不回退：multipart 分块间隙中模拟值可能已推高，
            // 下一个块的起始进度不应覆盖为更低的值
            this.uploadProgress = Math.max(this.uploadProgress, capped);
            this.uploadProgressLabel = `上传 ${uploadFile.name} ...`;
            lastRealProgressAt = Date.now();
          }
        };
        if (thumbnailDigest) headers["fd-thumbnail"] = thumbnailDigest;
        if (uploadFile.size >= SIZE_LIMIT) {
          await multipartUpload(`${basedir}${uploadFile.name}`, uploadFile, {
            headers,
            onUploadProgress,
            signal,
          });
        } else {
          await axios.put(uploadUrl, uploadFile, { headers, onUploadProgress, signal });
        }
        clearInterval(simulateTimer);
        this.uploadProgressLabel = `上传完成: ${uploadFile.name}`;
        this.uploadProgress = 100;
        await new Promise(r => setTimeout(r, 300));
      } catch (error) {
        clearInterval(simulateTimer);
        // 取消导致的 abort 不视为上传失败，跳过鉴权重定向检查
        if (!signal.aborted) {
          this.apiFetch("/api/write/")
            .then((value) => {
              if (value.redirected) window.location.href = value.url;
            })
            .catch(() => { });
          console.log(`Upload ${uploadFile.name} failed`, error);
        }
      }
      setTimeout(this.processUploadQueue);
    },

    cancelUpload() {
      if (this.uploadAbortCtrl) this.uploadAbortCtrl.abort();
      this.uploadAbortCtrl = null;
      this.uploadQueue = []; // 清空队列，不再处理后续文件
      this.uploadProgress = null;
      this.uploadProgressLabel = '已取消上传';
    },

    async removeFile(key) {
      const isFolder = key.endsWith("_$folder$");
      const displayName = isFolder ? key.slice(0, -9) : key;
      if (!window.confirm(isFolder ? `确定要删除文件夹 ${displayName} 及其所有内容吗？` : `确定要删除 ${displayName} 吗？`)) return;
      await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(key)}`);
      this.fetchFiles();
    },

    async renameFile(key) {
      const fileName = key.split('/').pop();
      const newName = window.prompt("重命名为:", fileName);
      if (!newName) return;
      await this.copyPaste(key, `${this.cwd}${newName}`);
      await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(key)}`);
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
        await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(oldMarker)}`);

        for (const item of allItems) {
          const relativePath = item.key.substring(oldBasePath.length);
          const newPath = newBasePath + relativePath;
          await this.copyPaste(item.key, newPath);
          await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(item.key)}`);
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
              await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(sourceBasePath + relativePath)}`);

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
              await axios.put(`/api/write/items/_fd_?name=${encodeURIComponent(subFolderMarker)}`, '');
            } catch (error) {
              console.error(`创建文件夹标记 ${subFolderMarker} 失败:`, error);
            }
          }

          // 创建目标目录标记
          const targetFolderPath = targetBasePath + '_$folder$';
          console.log('创建目标目录标记:', targetFolderPath);
          await axios.put(`/api/write/items/_fd_?name=${encodeURIComponent(targetFolderPath)}`, '');
          // 删除原目录标记
          await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(key)}`);

          // 清除进度
          this.uploadProgress = null;

          // 刷新文件列表（留在当前目录）
          this.fetchFiles();
        } else {
          // 单文件移动逻辑
          const targetFilePath = normalizedPath + fileName;
          await this.copyPaste(key, targetFilePath);
          await axios.delete(`/api/write/items/_fd_?name=${encodeURIComponent(key)}`);
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
        const url = new URL(this.childrenUrl(normalizedPrefix), window.location.origin);
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
        const url = new URL(this.childrenUrl(normalizedPrefix), window.location.origin);
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

    // ==================== 视频多线程预取 ====================

    /** 启动预取：先 HEAD 取文件大小，但等 loadedmetadata 后才开始下载 */
    async _startVideoPrefetch() {
      if (this._prefetchActive) return;
      const videoUrl = this.playerSrc;
      if (!videoUrl.startsWith('/raw/')) return;

      this._prefetchActive = true;
      this._prefetchUrl = videoUrl;
      this._prefetchEndByte = 0;
      this._prefetchMetadataHandled = false;
      this._prefetchCtrl = new AbortController();

      try {
        const headRes = await fetch(videoUrl, {
          method: 'HEAD',
          signal: this._prefetchCtrl.signal,
          headers: this._prefetchAuthHeaders(),
        });
        this._prefetchFileSize = parseInt(headRes.headers.get('Content-Length'), 10) || 0;
      } catch (e) {
        if (e.name === 'AbortError') return;
        this._stopVideoPrefetch();
        return;
      }

      if (this._prefetchFileSize <= 0) { this._stopVideoPrefetch(); return; }

      console.log('[Prefetch] ready, size=', (this._prefetchFileSize / 1024 / 1024).toFixed(1) + 'MB');

      const video = this.$refs.videoPlayer;
      if (video && video.readyState >= 1) {
        this._onVideoLoadedMetadata({ target: video });
      }
    },

    async _onVideoLoadedMetadata(e) {
      if (!this._prefetchActive || this._prefetchFileSize <= 0 || this._prefetchMetadataHandled) return;
      this._prefetchMetadataHandled = true;
      const video = e.target;

      // 从当前播放位置之后开始，跳过头一个 chunk，避免和播放器抢首包
      const currentByte = this._estimateCurrentByte(video);
      const CHUNK_SIZE = 2 * 1024 * 1024;
      const startByte = Math.min(this._prefetchFileSize, Math.max(0, currentByte + CHUNK_SIZE));
      console.log('[Prefetch] loadedmetadata, start from byte', startByte);
      this._prefetchBatch(startByte);
    },

    _stopVideoPrefetch() {
      if (!this._prefetchActive) return;
      this._prefetchActive = false;
      this._prefetchBatchRunning = false;
      this._prefetchMetadataHandled = false;
      if (this._prefetchSeekTimer) { clearTimeout(this._prefetchSeekTimer); this._prefetchSeekTimer = null; }
      if (this._prefetchCtrl) { this._prefetchCtrl.abort(); this._prefetchCtrl = null; }
      console.log('[Prefetch] stopped');
    },

    _prefetchAuthHeaders() {
      const h = {};
      const token = sessionStorage.getItem('flare_auth');
      if (token) h['X-Flare-Auth'] = token;
      return h;
    },

    _estimateCurrentByte(videoEl) {
      const dur = videoEl.duration;
      if (!dur || !isFinite(dur) || !this._prefetchFileSize) return 0;
      return Math.floor((videoEl.currentTime / dur) * this._prefetchFileSize);
    },

    async _prefetchBatch(fromByte) {
      if (this._prefetchBatchRunning) return;
      this._prefetchBatchRunning = true;
      const CHUNK_SIZE = 2 * 1024 * 1024;
      const BATCH_SIZE = 3;
      const PARALLEL = 1;
      const ctrl = this._prefetchCtrl; // 捕获当前 controller，seek 替换后检测退出
      const url = this._prefetchUrl;
      const fileSize = this._prefetchFileSize;
      let byte = fromByte;

      while (byte < fileSize && this._prefetchActive && this._prefetchCtrl === ctrl) {
        const toFetch = [];
        let end = byte, count = 0;
        while (count < BATCH_SIZE && end < fileSize) {
          const chunkEnd = Math.min(end + CHUNK_SIZE - 1, fileSize - 1);
          toFetch.push({ start: end, end: chunkEnd });
          count++; end = chunkEnd + 1;
        }
        if (toFetch.length === 0) break;

        // 乐观更新：批次开始就标记预期结束位置，避免 timeupdate 重复触发
        this._prefetchEndByte = end;
        console.log(`[Prefetch] batch bytes ${toFetch[0].start}-${toFetch[toFetch.length - 1].end}`);
        const results = [];
        for (let i = 0; i < toFetch.length; i += PARALLEL) {
          if (!this._prefetchActive || this._prefetchCtrl !== ctrl) return;
          const slice = toFetch.slice(i, i + PARALLEL);
          const batchResults = await Promise.allSettled(
            slice.map(({ start, end }) =>
              fetch(url, {
                headers: { ...this._prefetchAuthHeaders(), Range: `bytes=${start}-${end}` },
                signal: ctrl.signal,
              }).then(r => { if (r.ok) return r.arrayBuffer(); throw new Error(`${r.status}`); })
            )
          );
          if (this._prefetchCtrl !== ctrl) return; // controller 被替换，退出
          results.push(...batchResults);
        }

        const ok = results.filter(r => r.status === 'fulfilled').length;
        const totalBytes = toFetch.reduce((s, c) => s + (c.end - c.start + 1), 0);
        console.log(`[Prefetch] done: ${ok}/${toFetch.length} chunks, ${(totalBytes / 1024 / 1024).toFixed(1)}MB`);
        byte = end;
      }
      this._prefetchBatchRunning = false;
    },

    _onVideoTimeUpdate(e) {
      if (!this._prefetchActive || this._prefetchBatchRunning || this._prefetchSeekTimer) return;
      const currentByte = this._estimateCurrentByte(e.target);
      const margin = 15 * 1024 * 1024;
      if (currentByte + margin >= this._prefetchEndByte && this._prefetchEndByte < this._prefetchFileSize) {
        console.log('[Prefetch] timeupdate trigger from byte', currentByte);
        this._prefetchBatch(this._prefetchEndByte);
      }
    },

    _onVideoSeeked(e) {
      if (!this._prefetchActive) return;
      const video = e.target;
      if (this._prefetchSeekTimer) clearTimeout(this._prefetchSeekTimer);
      this._prefetchSeekTimer = setTimeout(() => {
        this._prefetchSeekTimer = null;
        if (!this._prefetchActive) return;
        const currentByte = this._estimateCurrentByte(video);
        const CHUNK_SIZE = 2 * 1024 * 1024;
        const windowStart = Math.max(0, this._prefetchEndByte - 10 * 1024 * 1024);
        const windowEnd = this._prefetchEndByte + CHUNK_SIZE;
        // 如果目标已经在当前预取窗口内，不用重启
        if (currentByte >= windowStart && currentByte <= windowEnd) return;

        console.log('[Prefetch] seek to byte', currentByte, 'restart');
        // 跳过当前播放位置后一个 chunk，避免和播放器刚 seek 完要拿的数据抢
        const startByte = Math.min(this._prefetchFileSize, currentByte + CHUNK_SIZE);
        // 先取消正在跑的批次，让 _prefetchBatchRunning 归位
        if (this._prefetchCtrl) this._prefetchCtrl.abort();
        this._prefetchCtrl = new AbortController();
        this._prefetchBatchRunning = false;
        this._prefetchEndByte = startByte;
        this._prefetchBatch(startByte);
      }, 300);
    },
  },

  watch: {
    showPlayer(val) {
      if (!val) this._stopVideoPrefetch();
    },
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
  display: flex;
  align-items: center;
  gap: 12px;
  max-width: 90vw;
  word-break: break-all;
}
.toast-btn {
  flex-shrink: 0;
  background: rgba(255,255,255,0.15);
  color: #fff;
  border: 1px solid rgba(255,255,255,0.3);
  padding: 4px 12px;
  border-radius: 4px;
  cursor: pointer;
  font-size: 13px;
  white-space: nowrap;
}
.toast-btn:hover {
  background: rgba(255,255,255,0.25);
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
