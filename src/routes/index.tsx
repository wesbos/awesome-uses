import { useLoaderData } from "@remix-run/react";
import { LoaderArgs } from "@remix-run/server-runtime";
import Topics from "../components/Topics";
import BackToTop from "../components/BackToTop";
import Person from "../components/Person";
import { getPeople } from "src/util/stats";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import throttle from "lodash.throttle";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { chunk } from "remeda";

const GRID_GAP = 50;
const ITEM_MIN_WIDTH = 350;
const ITEM_ESTIMATE_HEIGHT = 560;

export async function loader({ params }: LoaderArgs) {
  const people = getPeople(params.tag);
  return {people};
}

export default function Index() {
  const isMounted = useIsMounted();

  return (
    <>
      <Topics />
      {isMounted ? <PeopleGridClient /> : <PeopleGridServer />}
      <BackToTop />
    </>
  );
}

function PeopleGridClient() {
  const { people } = useLoaderData<typeof loader>();

  const GridContainerRef = useRef<HTMLDivElement>(null);
  const GridContainerOffsetRef = useRef<number>(0);
  useLayoutEffect(() => {
    GridContainerOffsetRef.current = GridContainerRef.current?.offsetTop ?? 0;
  }, []);

  const [width, setWidth] = useState<number>();
  useLayoutEffect(() => {
    const handleResize = throttle(() => {
      if (GridContainerRef.current) {
        setWidth(GridContainerRef.current.offsetWidth);
      }
    }, 100);

    if (GridContainerRef.current) {
      setWidth(GridContainerRef.current.offsetWidth);
    }

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
      handleResize.cancel();
    };
  }, []);

  const itemsPerRow = width
    ? Math.floor((width + GRID_GAP) / (ITEM_MIN_WIDTH + GRID_GAP))
    : 1;

  const rowsOfPeople = chunk(people, itemsPerRow);

  const rowVirtualizer = useWindowVirtualizer({
    count: Math.ceil(people.length / itemsPerRow),
    estimateSize: () => ITEM_ESTIMATE_HEIGHT,
    overscan: 5,
    scrollMargin: GridContainerOffsetRef.current,
  });

  const virtualRows = rowVirtualizer.getVirtualItems();

  return (
    <div ref={GridContainerRef}>
      <div
        style={{
          height: rowVirtualizer.getTotalSize(),
          width: "100%",
          position: "relative",
        }}
      >
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            transform: `translateY(${
              virtualRows[0].start - rowVirtualizer.options.scrollMargin
            }px)`,
          }}
        >
          {virtualRows.map((virtualRow) => {
            const items = rowsOfPeople[virtualRow.index];

            return (
              <div
                key={`row-${virtualRow.index}-${items[0].name}`}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(auto-fill, minmax(${ITEM_MIN_WIDTH}px, 1fr))`,
                    gridGap: `${GRID_GAP}px`,
                    paddingTop: virtualRow.index === 0 ? 0 : 50,
                  }}
                >
                  {items.map((item) => (
                    <div
                      key={item.name}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        display: "grid",
                      }}
                    >
                      <Person person={item} />
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function PeopleGridServer() {
  const { people } = useLoaderData<typeof loader>();
  return (
    <div className="People">
      {people.slice(0, 30).map((person) => (
        <Person key={person.name} person={person} />
      ))}
      {/* to prevent the huge scrollbar jump if we were rendering a lot more people on the client than the server */}
      {people.slice(30).map((person) => (
        <div
          key={person.name}
          style={{
            height: ITEM_ESTIMATE_HEIGHT,
          }}
        ></div>
      ))}
    </div>
  );
}

export function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return isMounted;
}

// why https://epicreact.dev/how-react-uses-closures-to-avoid-bugs/
export function useThrottle<
  Callback extends (...args: Parameters<Callback>) => ReturnType<Callback>
>(callback: Callback, delay: number) {
  const callbackRef = useRef(callback);
  useEffect(() => {
    callbackRef.current = callback;
  });
  return useMemo(
    () =>
      throttle(
        (...args: Parameters<Callback>) => callbackRef.current(...args),
        delay
      ),
    [delay]
  );
}
