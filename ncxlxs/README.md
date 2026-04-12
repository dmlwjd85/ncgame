# ncxlxs — 카드팩 엑셀 폴더

게임에서 사용할 **`.xlsx` 파일**을 이 폴더에 넣고, **`manifest.json`**의 `files` 배열에 파일 이름을 등록하세요.

## 사용 방법

1. `.xlsx` 파일을 이 폴더(`ncgame/ncxlxs/`)에 복사합니다.
2. `manifest.json`을 열어 `"files"`에 파일명을 추가합니다.

```json
{
  "files": ["예시팩.xlsx", "중간고사.xlsx"]
}
```

3. **통합 문서 안의 시트마다 하나의 카드팩**으로 불러옵니다. 시트마다 아래 **열 이름**이 첫 행에 있어야 합니다.

| 주제어 | 해설 | 학년/팩이름 또는 팩이름 | 난이도 |

4. 개발 서버(`npm run dev`) 또는 빌드(`npm run build`) 시 이 폴더 내용이 `dist/ncxlxs/`로 함께 포함됩니다.

## 배포 시

- Firebase Hosting / GitHub Pages 모두 빌드 산출물의 `ncxlxs/` 경로로 제공됩니다.
- 엑셀을 바꾼 뒤에는 **다시 빌드·배포**해야 반영됩니다.
