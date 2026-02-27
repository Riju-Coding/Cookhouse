interface TestPageProps{
    params: Promise<{ id: string }>
}

export default async function TestPage(
     { params }: TestPageProps
) {
    return (<>
    
    <h1>Test Page {(await params).id}</h1>
    
    </>);
}