import { MediaItem } from './media-item';
import { addImages, imagesOf, makeStart, moveImage, removeItem, renumber, setVideo, stepRole, videoOf } from './media-list';

const pic = (id: string): MediaItem => ({ id, type: 'image', name: id + '.png', url: id, previewUrl: id, sequence: null, file: null });
const vid = (id: string): MediaItem => ({ id, type: 'video', name: id + '.mp4', url: id, previewUrl: '', sequence: null, file: null });
const order = (items: MediaItem[]) => imagesOf(items).map((m) => m.id).join('');

describe('media sequence', () => {
  it('numbers pictures from 1 and keeps the video last without a number', () => {
    const list = setVideo(addImages([], [pic('a'), pic('b'), pic('c')]), vid('v'));
    expect(list.map((m) => m.sequence)).toEqual([1, 2, 3, null]);
    expect(list[3].type).toBe('video');
  });

  it('moves a picture and renumbers', () => {
    const list = addImages([], [pic('a'), pic('b'), pic('c'), pic('d')]);
    const moved = moveImage(list, 'd', 1);
    expect(order(moved)).toBe('adbc');
    expect(moved.map((m) => m.sequence)).toEqual([1, 2, 3, 4]);
  });

  it('makes any picture the start', () => {
    const list = addImages([], [pic('a'), pic('b'), pic('c')]);
    expect(order(makeStart(list, 'c'))).toBe('cab');
  });

  it('ignores moves that go outside the list or use an unknown id', () => {
    const list = addImages([], [pic('a'), pic('b')]);
    expect(order(moveImage(list, 'a', 99))).toBe('ba');
    expect(moveImage(list, 'zzz', 0)).toBe(list);
  });

  it('removes an item and closes the gap', () => {
    const list = addImages([], [pic('a'), pic('b'), pic('c')]);
    const after = removeItem(list, 'b');
    expect(after.map((m) => [m.id, m.sequence])).toEqual([['a', 1], ['c', 2]]);
  });

  it('keeps only one video: a new one replaces the old one', () => {
    const list = setVideo(setVideo([], vid('v1')), vid('v2'));
    expect(videoOf(list)?.id).toBe('v2');
    expect(list.length).toBe(1);
  });

  it('never changes the list it was given', () => {
    const list = renumber([pic('a'), pic('b')]);
    const copy = JSON.stringify(list);
    moveImage(list, 'b', 0); removeItem(list, 'a');
    expect(JSON.stringify(list)).toBe(copy);
  });

  it('says start / next / final for the cards', () => {
    expect([0, 1, 2, 3].map((i) => stepRole(i, 4))).toEqual(['start', 'next', 'next', 'final']);
    expect(stepRole(0, 1)).toBe('only');
  });
});
