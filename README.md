# ncgame

React · Vite · Firebase · Tailwind CSS 기반 교육용 웹 보드게임.

Firebase 프로젝트는 `2026sambong6`의 `sambongWorld.js`와 동일하게 `sambong-world-2026`을 사용합니다.

## 개발

```bash
npm install
npm run dev
```

## 로컬에서 Firebase Hosting 배포

1. [Firebase CLI](https://firebase.google.com/docs/cli) 로그인: `firebase login`
2. CI용 토큰 발급: `firebase login:ci` → 출력된 토큰을 GitHub 저장소 Secrets의 `FIREBASE_TOKEN`에 등록
3. 배포: `npm run deploy`

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

`main` 브랜치에 푸시하면 `.github/workflows/deploy-hosting.yml`이 빌드 후 Firebase Hosting에 배포합니다. `FIREBASE_TOKEN` 시크릿이 없으면 해당 작업은 실패합니다.

## 배포 주소 구분

| 방식 | 예시 URL | 설명 |
|------|-----------|------|
| **Firebase Hosting** | `https://sambong-world-2026.web.app` | 프로젝트 루트(`/`)에 배포 |
| **GitHub Pages** | `https://dmlwjd85.github.io/ncgame/` | 반드시 **`/ncgame/`** 까지 포함 (루트 `github.io`만 열면 404) |

예전에 쓰시던 **github.io/저장소이름** 형태는 GitHub Pages입니다. 이 저장소에는 Pages용 워크플로(`.github/workflows/deploy-github-pages.yml`)를 추가해 두었습니다.

**처음 한 번:** GitHub 저장소 → **Settings** → **Pages** → **Build and deployment** → **Source**를 **GitHub Actions**로 선택합니다. 그다음 `main`에 푸시하면 `deploy-github-pages`가 실행되고, 위 github.io 주소에서 동작합니다.

## 계정 (이름 + 비밀번호)

- Firebase Console → **Authentication** → **Sign-in method**에서 **이메일/비밀번호**를 사용 설정합니다.
- Firebase Console → **Firestore Database**에서 데이터베이스를 **생성**해 두어야 합니다. (아직 없으면 회원가입 시 `permission-denied`가 납니다.)
- 회원가입 시 표시 이름은 **Firestore** `loginByName` 문서와 연결되며, 내부적으로는 `프로젝트ID.firebaseapp.com` 도메인의 고유 가상 이메일로 Auth에 저장됩니다.
- **Firestore 규칙**은 저장소의 `firestore.rules`를 **반드시 배포**해야 회원가입이 됩니다. (`Missing or insufficient permissions` / `permission-denied` 방지)

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

웹 빌드(`dist`)를 네이티브 껍데기로 감싸 **Android / iOS** 프로젝트를 생성합니다.

```bash
npm install
npx cap add android
npx cap add ios
```

- iOS는 **macOS + Xcode**가 필요합니다.
- 스토어 제출 전: 앱 아이콘·스플래시·권한 문구·개인정보 처리방침·서명(Keystore / App Store Connect)을 각 스토어 가이드에 맞게 설정합니다.
- 네이티브에 올릴 웹 자산은 **루트 경로**로 빌드합니다.

```bash
npm run build:cap
```

이후 Android Studio / Xcode에서 열어 번들(AAB/APK) 또는 아카이브를 만듭니다.

```bash
npx cap open android
npx cap open ios
```
