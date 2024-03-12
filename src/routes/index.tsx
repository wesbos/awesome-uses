import { useLoaderData } from "@remix-run/react";
import { LoaderArgs } from "@remix-run/server-runtime";
import Topics from "../components/Topics";
import BackToTop from "../components/BackToTop";
import Person from "../components/Person";
import { getPeople } from "src/util/stats";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useWindowVirtualizer } from "@tanstack/react-virtual";
import { chunk } from "remeda";

const GRID_GAP = 50;
const PERSON_MIN_WIDTH = 350;
const PERSON_ESTIMATE_HEIGHT = 560;

export async function loader({ params }: LoaderArgs) {
  const people = getPeople(params.tag);
  return { people };
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
  const GridContainerOffsetTopRef = useRef<number>(0);
  const GridContainerOffsetWidthRef = useRef<number>(0);

  useLayoutEffect(() => {
    const handleResize = () => {
      if (GridContainerRef.current) {
        GridContainerOffsetTopRef.current = GridContainerRef.current.offsetTop;
        GridContainerOffsetWidthRef.current =
          GridContainerRef.current.offsetWidth;
      }
    };

    handleResize();

    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  const peoplePerRow = GridContainerOffsetWidthRef.current
    ? Math.floor(
        (GridContainerOffsetWidthRef.current + GRID_GAP) /
          (PERSON_MIN_WIDTH + GRID_GAP)
      )
    : 1;

  const rowsOfPeople = chunk(people, peoplePerRow);

  const rowVirtualizer = useWindowVirtualizer({
    count: rowsOfPeople.length,
    estimateSize: () => PERSON_ESTIMATE_HEIGHT,
    overscan: 5,
    scrollMargin: GridContainerOffsetTopRef.current,
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
            const people = rowsOfPeople[virtualRow.index];

            return (
              <div
                key={`row-${virtualRow.index}-${people[0].name}`}
                data-index={virtualRow.index}
                ref={rowVirtualizer.measureElement}
              >
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: `repeat(auto-fill, minmax(${PERSON_MIN_WIDTH}px, 1fr))`,
                    gridGap: `${GRID_GAP}px`,
                    paddingTop:
                      virtualRow.index === 0 ? `0px` : `${GRID_GAP}px`,
                  }}
                >
                  {people.map((person) => (
                    <div
                      key={person.name}
                      ref={rowVirtualizer.measureElement}
                      style={{
                        display: "grid",
                      }}
                    >
                      <Person person={person} />
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
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(auto-fill, minmax(${PERSON_MIN_WIDTH}px, 1fr))`,
        gridGap: `${GRID_GAP}px`,
      }}
    >
      {people.slice(0, 30).map((person) => (
        <Person key={person.name} person={person} />
      ))}
      {/* to prevent the huge scrollbar jump if we were rendering a lot more people on the client than the server */}
      {people.slice(30).map((person) => (
        <div
          key={person.name}
          style={{
            height: PERSON_ESTIMATE_HEIGHT,
          }}
        ></div>
      ))}
    </div>
  );
}

function useIsMounted() {
  const [isMounted, setIsMounted] = useState(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);
  return isMounted;
}
