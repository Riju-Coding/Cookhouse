interface ReviewPageProps {
    params: Promise<{ id: string, reviewid: string, searchParams: { [key: string]: string } }>
}


export default async function ReviewPage( { params }: ReviewPageProps ){
return (<>
    <h1>Review Page {(await params).reviewid} {(await params).id} </h1>
</>);
}