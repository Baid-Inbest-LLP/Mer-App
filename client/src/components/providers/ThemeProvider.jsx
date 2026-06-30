import { useEffect } from 'react';
import { useSelector } from 'react-redux';
import { useMantineColorScheme } from '@mantine/core';

export default function ThemeProvider({ children }) {
  const theme = useSelector((state) => state.common.theme);
  const { setColorScheme } = useMantineColorScheme();

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    setColorScheme(theme);
  }, [theme, setColorScheme]);

  return children;
}
