import { LoaderArgs, redirect } from "@remix-run/server-runtime"

export const loader = async ({ params }: LoaderArgs) => {
    if (!params.tag) return redirect("/")

    return redirect(`/?${new URLSearchParams({ like: params.tag }).toString()}`)
}
