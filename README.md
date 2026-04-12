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
| **GitHub Pages** | `https://dmlwjd85.github.io/ncgame/` | 저장소 이름이 URL 경로(`/ncgame/`)가 됨 |

예전에 쓰시던 **github.io/저장소이름** 형태는 GitHub Pages입니다. 이 저장소에는 Pages용 워크플로(`.github/workflows/deploy-github-pages.yml`)를 추가해 두었습니다.

**처음 한 번:** GitHub 저장소 → **Settings** → **Pages** → **Build and deployment** → **Source**를 **GitHub Actions**로 선택합니다. 그다음 `main`에 푸시하면 `deploy-github-pages`가 실행되고, 위 github.io 주소에서 동작합니다.
