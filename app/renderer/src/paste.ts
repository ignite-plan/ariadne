// 붙여넣기·끌어 놓기에서 이미지로 처리할지. Word·웹·메일에서 글자를 복사하면 클립보드에 그 부분을 찍은 그림(PNG)도
// 같이 들어간다. 글자가 있으면 글자로 붙여 넣고, 글자 없이 그림만 있을 때(화면 캡처, 그림 복사)만 이미지로 본다

export function imageToInsert<F extends { type: string }>(data: { getData(format: string): string; files: ArrayLike<F> } | null | undefined): F | undefined {
  if (!data) return undefined
  if (data.getData('text/plain').trim()) return undefined
  return Array.from(data.files).find((f) => f.type.startsWith('image/'))
}
