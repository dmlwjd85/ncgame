# ncgame

React · Vite · Firebase · Tailwind CSS 기반 교육용 웹 보드게임.

Firebase 프로젝트는 `2026sambong6`의 `sambongWorld.js`와 동일하게 `sambong-world-2026`을 사용합니다.

## 개발

```bash
npm install
npm run dev
```

## 로컬 빌드 확인

```bash
npm ci
npm run build
```

(Firebase Hosting에 올리는 배포는 CI에서 쓰지 않습니다. 웹 공개는 아래 **GitHub Pages** 워크플로만 사용합니다.)

## GitHub 저장소 생성 및 푸시

상위 폴더 `Project`와 별도로 이 디렉터리만의 Git 저장소입니다.

```bash
cd ncgame
gh auth login
gh repo create ncgame --public --source=. --remote=origin --push
```

이미 원격만 연결하는 경우:

```bash
git remote add origin https://github.com/<사용자>/ncgame.git
git push -u origin main
```

`main`(또는 `master`)에 푸시하면 `.github/workflows/deploy-github-pages.yml`만 실행되어 **GitHub Pages**에 올라갑니다. **Firebase Hosting용 GitHub Actions는 사용하지 않습니다.**

## 배포 주소 (GitHub Actions → GitHub Pages)

| 항목 | 내용 |
|------|------|
| 워크플로 파일 | `.github/workflows/deploy-github-pages.yml` |
| 공개 URL 예시 | `https://<사용자명>.github.io/ncgame/` — 주소 끝까지 **`/ncgame/`** 포함 (루트만 열면 404) |

**처음 한 번(필수):** GitHub 저장소 → **Settings** → **Pages** → **Build and deployment** → **Source**를 **GitHub Actions**로 바꿉니다. 그다음 `main`에 푸시하거나 Actions 탭에서 **Deploy GitHub Pages** 워크플로를 **Run workflow**로 수동 실행합니다.

같은 저장소의 Firebase 프로젝트(`sambong-world-2026`)를 쓰는 **별도** 주소(예: `*.web.app`)가 있을 수 있으나, **이 저장소 CI로 자동 배포하는 곳은 GitHub Pages뿐**입니다.

## 계정 (이름 + 비밀번호)

- Firebase Console → **Authentication** → **Sign-in method**에서 **이메일/비밀번호**를 사용 설정합니다.
- Firebase Console → **Firestore Database**는 프로젝트에 **이미 있으면** 새로 만들 필요 없습니다. ncgame은 삼봉 월드와 **같은 프로젝트·같은 DB**를 씁니다.
- 회원가입 시 표시 이름은 **Firestore** `loginByName` 문서와 연결되며, 내부적으로는 `프로젝트ID.firebaseapp.com` 도메인의 고유 가상 이메일로 Auth에 저장됩니다.
- **Firestore 규칙**은 `firestore.rules`에 **삼봉 월드(`artifacts/...`)와 ncgame(`loginByName`, `users`)이 함께** 들어 있습니다. 배포하면 기존 삼봉 데이터 규칙과 ncgame이 **한 규칙 파일**로 동작합니다.

  ```bash
  firebase login
  cd ncgame
  npm run deploy:rules
  ```

## 마스터(관리자) 로그인

1. Firebase Console → **Authentication** → **사용자 추가**로 아래와 같이 **이메일·비밀번호** 사용자를 직접 만듭니다. (이메일은 `.env`의 `VITE_MASTER_AUTH_EMAIL`과 동일해야 합니다.)
2. 프로젝트 루트 `.env.development` / `.env.production`(또는 CI Secrets)에 다음을 채웁니다.

   - `VITE_MASTER_DISPLAY_NAME` — 로그인 화면에 입력할 **이름**
   - `VITE_MASTER_PASSWORD` — 위에서 설정한 **비밀번호**와 동일
   - `VITE_MASTER_AUTH_EMAIL` — Firebase에 만든 **이메일**과 동일

3. 마스터로 로그인하면 `/admin` 엑셀 미리보기 메뉴가 보입니다. (클라이언트에 노출되므로 운영 시 서버 검증·역할 설계를 강화하세요.)

## ncxlxs 폴더 (엑셀 카드팩)

- 저장소 루트의 **`ncxlxs/`** 에 `.xlsx` 파일을 두고, **`ncxlxs/manifest.json`** 의 `"files"` 배열에 파일 이름을 나열합니다.
- **통합 문서 안의 시트마다 하나의 카드팩**으로 로드됩니다. 각 시트 1행에 열 이름: `주제어`, `해설`, `학년/팩이름`, `난이도`.
- `npm run dev` / `npm run build` 시 `dist/ncxlxs/`로 복사되어 배포에 포함됩니다. 엑셀을 바꾼 뒤에는 다시 빌드·배포해야 반영됩니다.

## 앱 스토어 / 플레이 스토어 (Capacitor)

웹 빌드(`dist`)를 네이티브 껍데기로 감싸 **Android / iOS** 프로젝트를 사용합니다. 저장소에 `android/` 폴더가 포함되어 있으면 `npx cap add android`는 생략해도 됩니다.

```bash
npm install
# android 폴더가 없을 때만
npx cap add android
npx cap add ios
```

- iOS는 **macOS + Xcode**가 필요합니다.
- 스토어 제출 전: 앱 아이콘·스플래시·권한 문구·개인정보 처리방침·서명(Keystore / App Store Connect)을 각 스토어 가이드에 맞게 설정합니다.
- 네이티브에 올릴 웹 자산은 **루트 경로**로 빌드합니다 (`build:cap`).

### Google Play용 AAB / APK (명령줄)

1. **JDK 17**(권장)과 **Android SDK**(Android Studio 설치 시 포함)가 필요합니다. 터미널에서 Gradle을 쓰려면 `JAVA_HOME`을 JDK 17 경로로 설정하고, Android Studio를 쓰면 메뉴 **Build → Generate Signed Bundle / APK**로도 동일한 결과물을 만들 수 있습니다.
2. **플레이 콘솔에 올릴 때**는 업로드 키로 서명한 AAB가 필요합니다.
   - `keytool`로 `.jks` 생성 후 `android/keystore.properties.example`을 복사해 `android/keystore.properties`로 두고 값을 채웁니다. (이 두 파일은 Git에 넣지 마세요.)
   - `keystore.properties`가 없으면 릴리스 빌드는 **디버그 키**로 서명되어 내부 테스트용으로만 쓰입니다.
3. 빌드 결과물 경로:
   - **AAB(스토어 권장):** `android/app/build/outputs/bundle/release/app-release.aab`
   - **APK:** `android/app/build/outputs/apk/release/app-release.apk`

```bash
npm run android:aab
npm run android:apk
```

Android Studio에서 열어 GUI로 빌드할 때는 다음과 같습니다.

```bash
npm run build:cap
npx cap open android
# iOS (macOS)
npx cap open ios
```
