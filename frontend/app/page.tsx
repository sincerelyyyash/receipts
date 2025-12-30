import { redirect } from 'next/navigation';

const HomePage = async () => {
  redirect('/dashboard');
};

export default HomePage;
